class DomainException(Exception):
    """Базовая ошибка домена"""

    detail = "Unexpected domain error"
    status_code = 500

    def __init__(self, *args):
        super().__init__(self.detail, *args)


class NotFoundError(DomainException):
    """Ресурс не найден."""

    detail = "Resource not found"
    status_code = 404

    def __init__(self, resource: str = ""):
        if resource:
            self.detail = f"Resource not found: {resource}"
        super().__init__()


class ConfigurationError(DomainException):
    """Ошибка конфигурации сервиса."""

    detail = "Service not configured"
    status_code = 500

    def __init__(self, service_name: str = ""):
        if service_name:
            self.detail = f"{service_name} is not configured"
        super().__init__()
