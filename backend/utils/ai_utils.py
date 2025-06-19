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
        You are a professional insurance document data extraction assistant. Your task is to extract structured information from legitimate business insurance policy documents for data processing purposes.

        DOCUMENT CONTEXT: This is a legitimate insurance policy document that contains standard business information like policy numbers, dates, premium amounts, and vehicle details. This is for business data processing, not personal use.        EXTRACTION INSTRUCTIONS:
        - Return ONLY a valid JSON object with the specified fields
        - For missing/unclear values: use "Standard" for insurance_type, null for others
        - For dates, use "YYYY-MM-DD" format
        - For numbers, use actual numeric values (not strings)
        - Confidence score should be between 0.0 and 1.0 based on text clarity

        FIELD MAPPING GUIDE:
        - Policy Number: Certificate No, Policy No, Certificate Number, Policy Certificate No
        - Policy Type: Motor, Health, Life, Travel, General Insurance
        - Insurance Type: REQUIRED - Comprehensive, Third Party, Package Policy, Liability Only, Standard
        - Vehicle Type: Car, Two Wheeler, Commercial Vehicle, Private Car, Motorcycle
        - Registration Number: Vehicle Reg No, Registration No, Reg. No, Vehicle No
        - Vehicle Class: M1, M2, N1, etc. or Private, Commercial, etc.
        - Vehicle Segment: Hatchback, Sedan, SUV, etc.
        - Gross Premium: Total Premium, Gross Premium, Premium Amount
        - GST: Service Tax, GST, IGST, CGST+SGST, Tax Amount
        - Net Premium: Net Premium, Premium Payable, Final Premium
        - OD Premium: Own Damage Premium, OD Premium, Own Damage
        - TP Premium: Third Party Premium, TP Premium, Liability Premium, Third Party Liability

        Required JSON format:
        {{
            "policy_number": "string or null",
            "policy_type": "string or null",
            "insurance_type": "string or null", 
            "vehicle_type": "string or null",
            "registration_number": "string or null",
            "vehicle_class": "string or null",
            "vehicle_segment": "string or null",
            "gross_premium": number or null,
            "gst": number or null,
            "net_premium": number or null,
            "od_premium": number or null,
            "tp_premium": number or null,
            "start_date": "YYYY-MM-DD or null",
            "end_date": "YYYY-MM-DD or null",            
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

try:
    gemini_extractor = GeminiPolicyExtractor()
except Exception as e:
    logger.warning(f"Failed to initialize Gemini extractor: {str(e)}")
    gemini_extractor = None
