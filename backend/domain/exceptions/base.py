class DomainException(Exception):
    """Базовая ошибка домена"""

    detail = "Unexpected domain error"
    status_code = 500

    def __init__(self, *args):
        super().__init__(self.detail, *args)
