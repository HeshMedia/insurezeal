from unstract.llmwhisperer import LLMWhispererClientV2
from unstract.llmwhisperer.client_v2 import LLMWhispererClientException
from typing import Optional
import logging
import os
import io
import tempfile

logger = logging.getLogger(__name__)

class PDFProcessor:
    def __init__(self):
        """Initialize the LLMWhisperer client"""
        try:
            self.client = LLMWhispererClientV2()
        except Exception as e:
            logger.error(f"Failed to initialize LLMWhisperer client: {str(e)}")
            self.client = None
    
    @staticmethod
    def get_client() -> Optional[LLMWhispererClientV2]:
        """Get a LLMWhisperer client instance"""
        try:
            return LLMWhispererClientV2()
        except Exception as e:
            logger.error(f"Failed to create LLMWhisperer client: {str(e)}")
            return None
    
    @staticmethod
    def extract_text_from_pdf(pdf_path: str) -> Optional[str]:
        """Extract text from PDF using LLMWhisperer"""
        try:
            if not os.path.exists(pdf_path):
                logger.error(f"PDF file not found: {pdf_path}")
                return None
            
            client = PDFProcessor.get_client()
            if not client:
                logger.error("LLMWhisperer client not available")
                return None
                
            # Use sync mode to wait for completion
            result = client.whisper(
                file_path=pdf_path,
                wait_for_completion=True,
                wait_timeout=200,
                mode="high_quality",
                output_mode="text"
            )
            
            if result.get("status_code") == 200 and result.get("extraction"):
                extracted_text = result["extraction"].get("result_text", "")
                return extracted_text.strip() if extracted_text else None
            else:
                logger.error(f"LLMWhisperer extraction failed: {result}")
                return None
                
        except LLMWhispererClientException as e:
            # Extract error details from the exception
            error_info = str(e)
            if hasattr(e, 'args') and len(e.args) > 0 and isinstance(e.args[0], dict):
                error_dict = e.args[0]
                message = error_dict.get('message', 'Unknown error')
                status_code = error_dict.get('status_code', 'Unknown')
                logger.error(f"LLMWhisperer error extracting text from PDF: {message}, Status Code: {status_code}")
            else:
                logger.error(f"LLMWhisperer error extracting text from PDF: {error_info}")
            return None
        except Exception as e:
            logger.error(f"Error extracting text from PDF: {str(e)}")
            return None
    
    @staticmethod
    def extract_text_from_bytes(pdf_bytes: bytes) -> Optional[str]:
        """Extract text from PDF bytes using LLMWhisperer"""
        try:
            client = PDFProcessor.get_client()
            if not client:
                logger.error("LLMWhisperer client not available")
                return None
            
            # Create a BytesIO stream from the bytes
            pdf_stream = io.BytesIO(pdf_bytes)
            
            # Use sync mode to wait for completion
            result = client.whisper(
                stream=pdf_stream,
                wait_for_completion=True,
                wait_timeout=200,
                mode="high_quality",
                output_mode="text"
            )
            
            if result.get("status_code") == 200 and result.get("extraction"):
                extracted_text = result["extraction"].get("result_text", "")
                return extracted_text.strip() if extracted_text else None
            else:
                logger.error(f"LLMWhisperer extraction failed: {result}")
                return None
            
        except LLMWhispererClientException as e:
            # Extract error details from the exception
            error_info = str(e)
            if hasattr(e, 'args') and len(e.args) > 0 and isinstance(e.args[0], dict):
                error_dict = e.args[0]
                message = error_dict.get('message', 'Unknown error')
                status_code = error_dict.get('status_code', 'Unknown')
                logger.error(f"LLMWhisperer error extracting text from PDF bytes: {message}, Status Code: {status_code}")
            else:
                logger.error(f"LLMWhisperer error extracting text from PDF bytes: {error_info}")
            return None
        except Exception as e:
            logger.error(f"Error extracting text from PDF bytes: {str(e)}")
            return None
    
    @staticmethod
    def validate_pdf_file(file_path: str) -> bool:
        """Validate if the file is a valid PDF by attempting to process it"""
        try:
            if not os.path.exists(file_path):
                return False
            
            # Check file extension first
            if not file_path.lower().endswith('.pdf'):
                return False
            
            # Try to read the file and check if it starts with PDF header
            with open(file_path, 'rb') as file:
                header = file.read(4)
                if header != b'%PDF':
                    return False
            
            # Optionally, you could try a quick LLMWhisperer validation
            # but this might use API quota, so we'll stick to basic validation
            return True
            
        except Exception as e:
            logger.error(f"PDF validation failed: {str(e)}")
            return False
    
    @staticmethod
    def validate_pdf_bytes(pdf_bytes: bytes) -> bool:
        """Validate if the bytes represent a valid PDF"""
        try:
            if not pdf_bytes or len(pdf_bytes) < 4:
                return False
            
            # Check PDF header
            if pdf_bytes[:4] != b'%PDF':
                return False
            
            # Optionally, you could try a quick LLMWhisperer validation
            # but this might use API quota, so we'll stick to basic validation
            return True
            
        except Exception as e:
            logger.error(f"PDF bytes validation failed: {str(e)}")
            return False
    
    @staticmethod
    def extract_text_from_pdf_async(pdf_path: str) -> Optional[dict]:
        """
        Extract text from PDF using LLMWhisperer in async mode
        Returns the whisper hash for later retrieval
        """
        try:
            if not os.path.exists(pdf_path):
                logger.error(f"PDF file not found: {pdf_path}")
                return None
            
            client = PDFProcessor.get_client()
            if not client:
                logger.error("LLMWhisperer client not available")
                return None
                
            # Use async mode (default)
            result = client.whisper(
                file_path=pdf_path,
                mode="high_quality",
                output_mode="text"
            )
            
            if result.get("status_code") == 202:
                return {
                    "whisper_hash": result.get("whisper_hash"),
                    "status": result.get("status"),
                    "message": result.get("message")
                }
            else:
                logger.error(f"LLMWhisperer async extraction failed: {result}")
                return None
                
        except LLMWhispererClientException as e:
            # Extract error details from the exception
            error_info = str(e)
            if hasattr(e, 'args') and len(e.args) > 0 and isinstance(e.args[0], dict):
                error_dict = e.args[0]
                message = error_dict.get('message', 'Unknown error')
                status_code = error_dict.get('status_code', 'Unknown')
                logger.error(f"LLMWhisperer error in async extraction: {message}, Status Code: {status_code}")
            else:
                logger.error(f"LLMWhisperer error in async extraction: {error_info}")
            return None
        except Exception as e:
            logger.error(f"Error in async PDF extraction: {str(e)}")
            return None
    
    @staticmethod
    def get_whisper_status(whisper_hash: str) -> Optional[dict]:
        """Get the status of a whisper operation"""
        try:
            client = PDFProcessor.get_client()
            if not client:
                logger.error("LLMWhisperer client not available")
                return None
            
            return client.whisper_status(whisper_hash)
            
        except LLMWhispererClientException as e:
            # Extract error details from the exception
            error_info = str(e)
            if hasattr(e, 'args') and len(e.args) > 0 and isinstance(e.args[0], dict):
                error_dict = e.args[0]
                message = error_dict.get('message', 'Unknown error')
                status_code = error_dict.get('status_code', 'Unknown')
                logger.error(f"LLMWhisperer error getting status: {message}, Status Code: {status_code}")
            else:
                logger.error(f"LLMWhisperer error getting status: {error_info}")
            return None
        except Exception as e:
            logger.error(f"Error getting whisper status: {str(e)}")
            return None
    
    @staticmethod
    def retrieve_whisper_result(whisper_hash: str) -> Optional[str]:
        """Retrieve the result of a whisper operation"""
        try:
            client = PDFProcessor.get_client()
            if not client:
                logger.error("LLMWhisperer client not available")
                return None
            
            result = client.whisper_retrieve(whisper_hash)
            
            if result.get("status_code") == 200 and result.get("extraction"):
                extracted_text = result["extraction"].get("result_text", "")
                return extracted_text.strip() if extracted_text else None
            else:
                logger.error(f"LLMWhisperer result retrieval failed: {result}")
                return None
            
        except LLMWhispererClientException as e:
            # Extract error details from the exception
            error_info = str(e)
            if hasattr(e, 'args') and len(e.args) > 0 and isinstance(e.args[0], dict):
                error_dict = e.args[0]
                message = error_dict.get('message', 'Unknown error')
                status_code = error_dict.get('status_code', 'Unknown')
                logger.error(f"LLMWhisperer error retrieving result: {message}, Status Code: {status_code}")
            else:
                logger.error(f"LLMWhisperer error retrieving result: {error_info}")
            return None
        except Exception as e:
            logger.error(f"Error retrieving whisper result: {str(e)}")
            return None
