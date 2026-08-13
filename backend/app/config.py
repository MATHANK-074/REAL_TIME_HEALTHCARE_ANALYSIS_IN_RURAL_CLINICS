import os
from dotenv import load_dotenv

# Load .env file
load_dotenv()

class Settings:
    DATABASE_URL: str = os.getenv("DATABASE_URL", "mysql+pymysql://root:@localhost:3306/rural_healthcare")
    JWT_SECRET: str = os.getenv("JWT_SECRET", "fdf894a4c6a6d65be6ebdf3e223da16a8d67c9c0bfe7a1da4b72c91823ab1a5c")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "120"))
    RISK_CONFIG_PATH: str = os.getenv("RISK_CONFIG_PATH", "backend/app/ml/risk_config.json")
    SMS_API_KEY: str = os.getenv("SMS_API_KEY", "mock_dev_key_12345")
    SMS_SENDER_NAME: str = os.getenv("SMS_SENDER_NAME", "RURALCARE")

settings = Settings()
