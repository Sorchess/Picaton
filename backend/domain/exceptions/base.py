class DomainException(Exception):
    """Базовая ошибка домена"""

    detail = "Unexpected domain error"
    status_code = 500

    def __init__(self, *args):
        super().__init__(self.detail, *args)


class ConfigurationError(DomainException):
    """Ошибка конфигурации сервиса."""

    detail = "Service not configured"
    status_code = 500

    def __init__(self, service_name: str = ""):
        if service_name:
            self.detail = f"{service_name} is not configured"
        super().__init__()
