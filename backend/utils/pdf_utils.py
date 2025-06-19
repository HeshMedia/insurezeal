import PyPDF2
from typing import Optional
import logging
import os
import io

logger = logging.getLogger(__name__)

class PDFProcessor:
    @staticmethod
    def extract_text_from_pdf(pdf_path: str) -> Optional[str]:
        """Extract text from PDF using PyPDF2"""
        try:
            if not os.path.exists(pdf_path):
                logger.error(f"PDF file not found: {pdf_path}")
                return None
                
            with open(pdf_path, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                text = ""
                
                for page_num in range(len(pdf_reader.pages)):
                    page = pdf_reader.pages[page_num]
                    text += page.extract_text() + "\n"
                
                return text.strip()
                
        except Exception as e:
            logger.error(f"Error extracting text from PDF: {str(e)}")
            return None
    
    @staticmethod
    def extract_text_from_bytes(pdf_bytes: bytes) -> Optional[str]:
        """Extract text from PDF bytes using PyPDF2"""
        try:
            pdf_stream = io.BytesIO(pdf_bytes)
            pdf_reader = PyPDF2.PdfReader(pdf_stream)
            text = ""
            
            for page_num in range(len(pdf_reader.pages)):
                page = pdf_reader.pages[page_num]
                text += page.extract_text() + "\n"
            
            return text.strip()
            
        except Exception as e:
            logger.error(f"Error extracting text from PDF bytes: {str(e)}")
            return None
    
    @staticmethod
    def validate_pdf_file(file_path: str) -> bool:
        """Validate if the file is a valid PDF"""
        try:
            with open(file_path, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                if len(pdf_reader.pages) > 0:
                    return True
                return False
        except Exception as e:
            logger.error(f"PDF validation failed: {str(e)}")
            return False
    
    @staticmethod
    def validate_pdf_bytes(pdf_bytes: bytes) -> bool:
        """Validate if the bytes represent a valid PDF"""
        try:
            pdf_stream = io.BytesIO(pdf_bytes)
            pdf_reader = PyPDF2.PdfReader(pdf_stream)
            if len(pdf_reader.pages) > 0:
                return True
            return False
        except Exception as e:
            logger.error(f"PDF bytes validation failed: {str(e)}")
            return False
