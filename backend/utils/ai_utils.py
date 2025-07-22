import google.generativeai as genai
import json
from typing import Dict, Any, Optional
import logging
import os
import requests
from utils.pdf_utils import PDFProcessor

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
        
        PREMIUM CALCULATION RULES:
        - gross_premium = Final Premium (the total amount customer pays)
        - If you see "Final premium ₹4,030.88", then gross_premium should be 4030.88
        
        PREMIUM IDENTIFICATION (COMPANY-SPECIFIC HANDLING):
        - net_premium (NP): Look for "Net Premium", "Total Package Premium", "Sec 1+2+3", "Sec I+II", "Section A+B", or sum of package sections
        - tp_premium (TP): Look for "Total Liability Premium", "Total Act Premium", "Third Party Premium", or liability-specific amounts or sum up all third party components (Basic TP + Legal Liability + PA cover)
        - IMPORTANT: 
          * If "Total Package Premium" or sectional premiums (Sec 1+2+3) appear → it's NP
          * For comprehensive policies: NP should be higher than TP
          * For liability-only policies: TP and NP will mostly be same
        - od_premium: Own Damage Premium, Section 1 Premium, Property Damage Premium
        - gst_amount should be total GST/tax amount

        COMPREHENSIVE FIELD MAPPING:
        
        BASIC POLICY INFORMATION:
        - policy_number: Extract the complete policy number exactly as it appears in the PDF, including all "/" and "-" characters. For "P0026100026/4103/100341", extract "P0026100026/4103/100341"
        - formatted_policy_number: Prefix with hash symbol and include complete policy number with original formatting. For "P0026100026/4103/100341", return "#P0026100026/4103/100341"
        - major_categorisation: Motor, Life, Health, Travel, General Insurance
        - product_insurer_report: Product name from insurer report
        - product_type: Private Car, Two Wheeler, Commercial Vehicle, etc. Include vehicle category like (GCV), (SCV), (PCV) in brackets
        - plan_type: Determine based on coverage type:
          * "Comprehensive" - if policy covers both OD (Own Damage) and TP (Third Party)
          * "STP" (Stand-alone TP) - if policy covers only Third Party/Liability
          * "SAOD" (Stand-alone OD) - if policy covers only Own Damage
          * Look for keywords: "Comprehensive", "Package Policy", "Liability Only", "Act Only", "TP Only"
        - customer_name: Policy holder name, insured name
        - customer_phone_number: Customer phone number or mobile number if available

        PREMIUM & FINANCIAL DETAILS:
        - gross_premium: Final Premium, Total Premium (sum of all components including taxes)
        - net_premium: Base Premium, Net Premium (before taxes and additions)
        - od_premium: Own Damage Premium, OD Premium, Own Damage
        - tp_premium: Total Third Party Premium amount including all liability components. Look for "Total Act Premium", "Total Liability Premium", or sum of all third-party related premiums including Basic Third-Party Liability, Legal Liability, PA cover, etc. Do NOT use just "Basic Third-Party Liability" - include all TP components.
        - gst_amount: Service Tax, GST, IGST, CGST+SGST, Tax Amount, CGST, SGST
        
        IMPORTANT: 
        - gross_premium should be the FINAL PREMIUM amount (the total you pay)
        - If you see "Final Premium" or "Total Premium", that is the gross_premium
        - tp_premium should be the TOTAL third party amount (like "Total Act Premium" in liability section), not just basic TP
        - Include all third-party related components: Basic TP + Legal Liability + PA cover + any other liability premiums
        - gst_amount should be the total tax amount (CGST + SGST combined)

        VEHICLE DETAILS (for Motor Insurance):
        - registration_no: Vehicle Reg No, Registration No, Reg. No, Vehicle No (clean format without dashes or spaces)
        - make_model: Vehicle make and model combined
        - model: Specific model name
        - vehicle_variant: Variant like VXI, ZXI, LXI, etc.
        - gvw: Gross Vehicle Weight, do not convert to any unit, just extract the integer value as is for example "2500" for "2,500 KG"
        - rto: RTO code like MH01, DL01, etc. (extract first 4 characters of registration number)
        - state: State of registration
        - fuel_type: Petrol, Diesel, CNG, Electric
        - cc: Engine capacity in CC
        - age_year: Calculate vehicle age based on manufacturing year:
          * Find "Manufacturing Year", "Model Year", "Year of Manufacture" in the policy
          * Calculate: current_year - manufacturing_year
          * for the following examples assume current year is 2025 but do check the current year
          * If manufacturing year is 2025, then age = 0
          * If manufacturing year is 2020, then age = 5
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
            "customer_phone_number": "string or null",
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
            "manufacturing_year": number or null,
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
            if len(pdf_text) > 16000:
                pdf_text = pdf_text[:16000] + "..."
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
            
            # Post-process extracted data
            extracted_data = self._post_process_extracted_data(extracted_data)
            
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

    def _post_process_extracted_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Post-process extracted data to clean and format fields"""
        try:
            # Process policy numbers
            if data.get('policy_number'):
                policy_num = str(data['policy_number']).strip()
                # Keep the complete policy number with all "/" and "-" characters as-is
                data['policy_number'] = policy_num
                
                # Set formatted policy number with "#" prefix and full original format
                if not data.get('formatted_policy_number'):
                    data['formatted_policy_number'] = '#' + policy_num
                elif not str(data['formatted_policy_number']).startswith('#'):
                    data['formatted_policy_number'] = '#' + str(data['formatted_policy_number'])
            
            # Clean registration number - remove dashes, spaces, and special characters
            if data.get('registration_no'):
                reg_no = str(data['registration_no']).upper()
                # Remove common separators and spaces
                reg_no = reg_no.replace('-', '').replace(' ', '').replace('_', '').replace('.', '')
                data['registration_no'] = reg_no
                
                # Extract RTO from first 4 characters of registration number
                if len(reg_no) >= 4:
                    data['rto'] = reg_no[:4]
            
            return data
            
        except Exception as e:
            logger.error(f"Error in post-processing extracted data: {str(e)}")
            return data

async def extract_policy_data_from_pdf(pdf_url: str) -> Dict[str, Any]:
    """Extract comprehensive policy data from PDF using the Gemini extractor"""
    try:
        if not gemini_extractor:
            logger.error("Gemini extractor not available")
            return {}
        
        # Download PDF from URL and extract text
        logger.info(f"Downloading PDF from URL: {pdf_url}")
        try:
            response = requests.get(pdf_url, timeout=30)
            response.raise_for_status()
            pdf_bytes = response.content
            
            # Extract text from PDF bytes
            pdf_text = PDFProcessor.extract_text_from_bytes(pdf_bytes)
            if not pdf_text or len(pdf_text.strip()) < 50:
                logger.warning("No meaningful text extracted from PDF")
                return {}
                
        except requests.RequestException as e:
            logger.error(f"Failed to download PDF from {pdf_url}: {str(e)}")
            return {}
        except Exception as e:
            logger.error(f"Failed to extract text from PDF: {str(e)}")
            return {}
        
        logger.info(f"Extracting comprehensive policy data from PDF: {pdf_url}")
        logger.info(f"Extracted text length: {len(pdf_text)} characters")
        
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
                "customer_phone_number": extracted_data.get("customer_phone_number"),
                
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
                "manufacturing_year": extracted_data.get("manufacturing_year"),
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

async def extract_policy_data_from_pdf_bytes(pdf_bytes: bytes) -> Dict[str, Any]:
    """Extract comprehensive policy data from PDF bytes using the Gemini extractor (stateless)"""
    try:
        if not gemini_extractor:
            logger.error("Gemini extractor not available")
            return {}
        
        # Extract text directly from PDF bytes
        pdf_text = PDFProcessor.extract_text_from_bytes(pdf_bytes)
        if not pdf_text or len(pdf_text.strip()) < 50:
            logger.warning("No meaningful text extracted from PDF bytes")
            return {}
        
        logger.info(f"Extracting comprehensive policy data from PDF bytes ({len(pdf_bytes)} bytes)")
        logger.info(f"Extracted text length: {len(pdf_text)} characters")
        
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
                "customer_phone_number": extracted_data.get("customer_phone_number"),
                
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
                "manufacturing_year": extracted_data.get("manufacturing_year"),
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
        logger.error(f"Error extracting policy data from bytes: {str(e)}")
        return {}

try:
    gemini_extractor = GeminiPolicyExtractor()
except Exception as e:
    logger.warning(f"Failed to initialize Gemini extractor: {str(e)}")
    gemini_extractor = None
