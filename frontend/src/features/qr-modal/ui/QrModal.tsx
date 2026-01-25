import { Modal } from "@/shared";
import "./QrModal.scss";

interface QrModalProps {
  isOpen: boolean;
  onClose: () => void;
  qrCodeImage: string;
  userName?: string;
  eventName?: string;
  scanCount?: number;
  onOpenCard?: () => void;
  onSaveQr?: () => void;
  onShare?: () => void;
}

// Back arrow icon
const BackArrowIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M15 18L9 12L15 6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// Share arrow icon
const ShareArrowIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M12 3L12 15M12 3L7 8M12 3L17 8"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M3 15V17C3 18.6569 4.34315 20 6 20H18C19.6569 20 21 18.6569 21 17V15"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// Download icon
const DownloadIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M12 3V15M12 15L7 10M12 15L17 10"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M3 15V17C3 18.6569 4.34315 20 6 20H18C19.6569 20 21 18.6569 21 17V15"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export function QrModal({
  isOpen,
  onClose,
  qrCodeImage,
  userName,
  eventName = "Хищный процесс 2026",
  scanCount = 0,
  onOpenCard,
  onSaveQr,
  onShare,
}: QrModalProps) {
  const handleSaveQr = () => {
    if (onSaveQr) {
      onSaveQr();
      return;
    }
    // Default save behavior - download the image
    const link = document.createElement("a");
    link.href = qrCodeImage;
    link.download = `qr-code-${userName || "contact"}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleShare = async () => {
    if (onShare) {
      onShare();
      return;
    }
    // Default share behavior
    if (navigator.share) {
      try {
        await navigator.share({
          title: userName || "QR код визитки",
          text: `QR код визитки ${userName || ""}`,
        });
      } catch (err) {
        console.log("Share cancelled or failed");
      }
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      className="qr-modal-wrapper"
    >
      <div className="qr-modal">
        {/* Header */}
        <div className="qr-modal__header">
          <button
            className="qr-modal__back-btn"
            onClick={onClose}
            aria-label="Назад"
          >
            <BackArrowIcon />
          </button>

          <div className="qr-modal__event-badge">
            <span className="qr-modal__event-name">{eventName}</span>
          </div>

          {scanCount > 0 && (
            <div className="qr-modal__scan-badge">
              <span>{scanCount}</span>
            </div>
          )}
        </div>

        {/* QR Code */}
        <div className="qr-modal__content">
          <div className="qr-modal__qr-container">
            <img src={qrCodeImage} alt="QR Code" className="qr-modal__image" />
          </div>
        </div>

        {/* Action buttons */}
        <div className="qr-modal__actions">
          <button className="qr-modal__action-btn" onClick={onOpenCard}>
            <span className="qr-modal__action-text">Открыть визитку</span>
            <span className="qr-modal__action-icon">
              <ShareArrowIcon />
            </span>
          </button>

          <button className="qr-modal__action-btn" onClick={handleSaveQr}>
            <span className="qr-modal__action-text">Сохранить QR</span>
            <span className="qr-modal__action-icon">
              <DownloadIcon />
            </span>
          </button>
        </div>

        {/* Share button */}
        <div className="qr-modal__footer">
          <button className="qr-modal__share-btn" onClick={handleShare}>
            Поделиться визиткой
          </button>
        </div>
      </div>
    </Modal>
  );
}
