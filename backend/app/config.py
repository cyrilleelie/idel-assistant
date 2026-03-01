from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str
    database_url_sync: str = ""
    redis_url: str
    secret_key: str
    encryption_master_key: str
    openrouteservice_api_key: str = ""
    environment: str = "development"
    debug: bool = True

    # JWT
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    # Agent IA / LLM
    mistral_api_key: str = ""
    llm_provider: str = "mistral_cloud"
    llm_model_name: str = "mistral-large-latest"
    llm_base_url: str = "https://api.mistral.ai/v1"
    llm_temperature: float = 0.3
    llm_max_tokens: int = 2048
    agent_session_ttl_seconds: int = 14400  # 4h
    agent_max_history_messages: int = 20
    agent_max_tool_calls_per_request: int = 10

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
