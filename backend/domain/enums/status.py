from enum import Enum


class UserStatus(str, Enum):
    AVAILABLE = "available"
    BUSY = "busy"
    VACATION = "vacation"
    INACTIVE = "inactive"
