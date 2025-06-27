import google.generativeai as genai
import json
from typing import Dict, Any, Optional
import logging
import os

logger = logging.getLogger(__name__)

class GeminiPolicyExtractor:
    def __init__(self):
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY environment variable not set")        
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel('gemini-1.5-flash')
    
    def create_extraction_prompt(self, pdf_text: str) -> str:
        return f"""
        You are a professional insurance document data extraction assistant. Your task is to extract structured information from legitimate business insurance policy documents for comprehensive CutPay processing.

        DOCUMENT CONTEXT: This is a legitimate insurance policy document that contains standard business information like policy numbers, dates, premium amounts, and vehicle details. This is for business data processing, not personal use.

        EXTRACTION INSTRUCTIONS:
        - Return ONLY a valid JSON object with the specified fields
        - For missing/unclear values: use null
        - For dates, use "YYYY-MM-DD" format
        - For numbers, use actual numeric values (not strings)
        - Confidence score should be between 0.0 and 1.0 based on text clarity

        COMPREHENSIVE FIELD MAPPING:
        
        BASIC POLICY INFORMATION:
        - policy_number: Certificate No, Policy No, Certificate Number, Policy Certificate No
        - formatted_policy_number: Formatted version with dashes/spaces
        - major_categorisation: Motor, Life, Health, Travel, General Insurance
        - product_insurer_report: Product name from insurer report
        - product_type: Private Car, Two Wheeler, Commercial Vehicle, etc.
        - plan_type: Comprehensive, Third Party, Package Policy, Liability Only
        - customer_name: Policy holder name, insured name

        PREMIUM & FINANCIAL DETAILS:
        - gross_premium: Total Premium, Gross Premium, Premium Amount
        - net_premium: Net Premium, Premium Payable, Final Premium
        - od_premium: Own Damage Premium, OD Premium, Own Damage
        - tp_premium: Third Party Premium, TP Premium, Liability Premium
        - gst_amount: Service Tax, GST, IGST, CGST+SGST, Tax Amount

        VEHICLE DETAILS (for Motor Insurance):
        - registration_no: Vehicle Reg No, Registration No, Reg. No, Vehicle No
        - make_model: Vehicle make and model combined
        - model: Specific model name
        - vehicle_variant: Variant like VXI, ZXI, LXI, etc.
        - gvw: Gross Vehicle Weight
        - rto: RTO code like MH01, DL01, etc.
        - state: State of registration
        - fuel_type: Petrol, Diesel, CNG, Electric
        - cc: Engine capacity in CC
        - age_year: Vehicle age in years
        - ncb: No Claim Bonus (YES/NO or percentage)
        - discount_percent: Discount percentage applied
        - business_type: Private, Commercial, Taxi, etc.
        - seating_capacity: Number of seats
        - veh_wheels: Number of wheels (2/4)

        Required JSON format:
        {{
            "policy_number": "string or null",
            "formatted_policy_number": "string or null",
            "major_categorisation": "string or null",
            "product_insurer_report": "string or null",
            "product_type": "string or null",
            "plan_type": "string or null",
            "customer_name": "string or null",
            "gross_premium": number or null,
            "net_premium": number or null,
            "od_premium": number or null,
            "tp_premium": number or null,
            "gst_amount": number or null,
            "registration_no": "string or null",
            "make_model": "string or null",
            "model": "string or null",
            "vehicle_variant": "string or null",
            "gvw": number or null,
            "rto": "string or null",
            "state": "string or null",
            "fuel_type": "string or null",
            "cc": number or null,
            "age_year": number or null,
            "ncb": "string or null",
            "discount_percent": number or null,
            "business_type": "string or null",
            "seating_capacity": number or null,
            "veh_wheels": number or null,
            "confidence_score": number
        }}

        Document text:
        {pdf_text}
        """
    
    def extract_policy_data(self, pdf_text: str) -> Optional[Dict[str, Any]]:
        """Extract structured policy data using Gemini"""
        try:
            if len(pdf_text) > 8000:
                pdf_text = pdf_text[:8000] + "..."
                logger.info("Truncated PDF text to avoid safety filter issues")
            
            prompt = self.create_extraction_prompt(pdf_text)
            safety_settings = [
                {
                    "category": "HARM_CATEGORY_HARASSMENT",
                    "threshold": "BLOCK_NONE"
                },
                {
                    "category": "HARM_CATEGORY_HATE_SPEECH", 
                    "threshold": "BLOCK_NONE"
                },
                {
                    "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                    "threshold": "BLOCK_NONE"
                },
                {
                    "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
                    "threshold": "BLOCK_NONE"
                }
            ]
            
            response = self.model.generate_content(
                prompt,
                generation_config=genai.types.GenerationConfig(
                    temperature=0.1,
                    max_output_tokens=1024,
                    candidate_count=1,
                ),
                safety_settings=safety_settings
            )
            
            if not response.parts:
                logger.error("Gemini response was blocked by safety filters")
                if response.candidates and len(response.candidates) > 0:
                    finish_reason = response.candidates[0].finish_reason
                    logger.error(f"Finish reason: {finish_reason}")
                    
                    return self._try_fallback_extraction(pdf_text)
                return None
            
            json_text = response.text.strip()
            
            if json_text.startswith('```json'):
                json_text = json_text.replace('```json', '').replace('```', '').strip()
            elif json_text.startswith('```'):
                json_text = json_text.replace('```', '').strip()
            
            extracted_data = json.loads(json_text)
            
            if 'confidence_score' not in extracted_data:
                extracted_data['confidence_score'] = 0.5
            
            logger.info(f"Successfully extracted policy data with confidence: {extracted_data.get('confidence_score', 0)}")
            return extracted_data
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse Gemini response as JSON: {str(e)}")
            if 'response' in locals():
                logger.error(f"Raw response: {response.text if response.parts else 'No response parts'}")
            return None
            
        except Exception as e:
            logger.error(f"Error extracting policy data with Gemini: {str(e)}")
            if 'response' in locals():
                try:
                    if hasattr(response, 'candidates') and response.candidates:
                        logger.error(f"Response finish reason: {response.candidates[0].finish_reason}")
                    logger.error(f"Response parts available: {bool(response.parts)}")
                except:
                    pass
            return None
    
    def _try_fallback_extraction(self, pdf_text: str) -> Optional[Dict[str, Any]]:
        """Fallback extraction with simpler prompt"""
        try:
            simple_prompt = f"""
            Extract data from this business insurance document. Return only JSON:
            
            {{
                "policy_number": "find policy/certificate number",
                "policy_type": "Motor/Health/Life etc",
                "registration_number": "vehicle registration",
                "gross_premium": "total premium amount",
                "start_date": "policy start date YYYY-MM-DD",
                "end_date": "policy end date YYYY-MM-DD",
                "confidence_score": 0.7
            }}
            
            Document: {pdf_text[:3000]}
            """
            
            response = self.model.generate_content(
                simple_prompt,
                generation_config=genai.types.GenerationConfig(
                    temperature=0.2,
                    max_output_tokens=512,
                )
            )
            
            if response.parts:
                json_text = response.text.strip()
                if json_text.startswith('```'):
                    json_text = json_text.replace('```json', '').replace('```', '').strip()
                
                return json.loads(json_text)
            
        except Exception as e:
            logger.error(f"Fallback extraction also failed: {str(e)}")
        
        return None

async def extract_policy_data_from_pdf(pdf_url: str) -> Dict[str, Any]:
    """Extract comprehensive policy data from PDF using the Gemini extractor"""
    try:
        if not gemini_extractor:
            logger.error("Gemini extractor not available")
            return {}
        
        # TODO: Implement actual PDF text extraction from URL
        # For now, this would need to be implemented to:
        # 1. Download PDF from URL
        # 2. Extract text using PyPDF2 or similar
        # 3. Pass extracted text to Gemini
        
        # Placeholder for PDF text extraction
        pdf_text = f"PDF content from {pdf_url} would be extracted here"
        
        logger.info(f"Extracting comprehensive policy data from PDF: {pdf_url}")
        extracted_data = gemini_extractor.extract_policy_data(pdf_text)
        
        if extracted_data:
            # Return data matching our ExtractedPolicyData schema
            return {
                # Basic Policy Information
                "policy_number": extracted_data.get("policy_number"),
                "formatted_policy_number": extracted_data.get("formatted_policy_number"),
                "major_categorisation": extracted_data.get("major_categorisation"),
                "product_insurer_report": extracted_data.get("product_insurer_report"),
                "product_type": extracted_data.get("product_type"),
                "plan_type": extracted_data.get("plan_type"),
                "customer_name": extracted_data.get("customer_name"),
                
                # Premium & Financial Details
                "gross_premium": extracted_data.get("gross_premium"),
                "net_premium": extracted_data.get("net_premium"),
                "od_premium": extracted_data.get("od_premium"),
                "tp_premium": extracted_data.get("tp_premium"),
                "gst_amount": extracted_data.get("gst_amount"),
                
                # Vehicle Details
                "registration_no": extracted_data.get("registration_no"),
                "make_model": extracted_data.get("make_model"),
                "model": extracted_data.get("model"),
                "vehicle_variant": extracted_data.get("vehicle_variant"),
                "gvw": extracted_data.get("gvw"),
                "rto": extracted_data.get("rto"),
                "state": extracted_data.get("state"),
                "fuel_type": extracted_data.get("fuel_type"),
                "cc": extracted_data.get("cc"),
                "age_year": extracted_data.get("age_year"),
                "ncb": extracted_data.get("ncb"),
                "discount_percent": extracted_data.get("discount_percent"),
                "business_type": extracted_data.get("business_type"),
                "seating_capacity": extracted_data.get("seating_capacity"),
                "veh_wheels": extracted_data.get("veh_wheels"),
                "confidence_score": extracted_data.get("confidence_score", 0.0)
            }
        else:
            logger.warning("No data extracted from Gemini")
            return {}
            
    except Exception as e:
        logger.error(f"Error extracting policy data: {str(e)}")
        return {}

try:
    gemini_extractor = GeminiPolicyExtractor()
except Exception as e:
    logger.warning(f"Failed to initialize Gemini extractor: {str(e)}")
    gemini_extractor = None
