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
    llm_temperature: float = 0.1
    llm_max_tokens: int = 2048
    agent_session_ttl_seconds: int = 14400  # 4h
    agent_max_history_messages: int = 20
    agent_max_tool_calls_per_request: int = 10

    # Agent IA / Voix — cloud (itération C)
    openai_api_key: str = ""                      # Whisper STT
    elevenlabs_api_key: str = ""                  # TTS
    elevenlabs_voice_id: str = "charlotte"        # ID voix française ElevenLabs
    tts_enabled: bool = True                      # Peut être désactivé globalement
    stt_provider: str = "whisper_cloud"           # "whisper_cloud" | "faster_whisper_local"
    tts_provider: str = "elevenlabs"              # "elevenlabs" | "kokoro_local"

    # Agent IA / GPU self-hosted — itération D
    gpu_base_url: str = ""                        # IP privée vRack OVH, ex: "http://10.0.0.5:9000"
    vllm_base_url: str = ""                       # Dérivé de gpu_base_url/v1 si non spécifié
    whisper_local_url: str = ""                   # Dérivé de gpu_base_url si non spécifié
    kokoro_local_url: str = ""                    # Dérivé de gpu_base_url si non spécifié

    # Agent IA / Fine-tuning — itération E
    lora_model_name: str = ""                     # Ex: "idel-v1" — vide = pas de LoRA

    # Secrétaire médical IA — itération F
    receptionist_enabled: bool = False
    receptionist_greeting_delay_ms: int = 500
    ovh_sms_app_key: str = ""
    ovh_sms_app_secret: str = ""
    ovh_sms_consumer_key: str = ""
    ovh_sms_account: str = ""
    ovh_sms_sender: str = "Cabinet IDEL"
    cabinet_service_token: str = ""               # Token service pour Asterisk → WS

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
