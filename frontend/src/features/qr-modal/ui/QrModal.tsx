import { Modal } from "@/shared";
import "./QrModal.scss";

interface QrModalProps {
  isOpen: boolean;
  onClose: () => void;
  qrCodeImage: string;
  userName?: string;
}

export function QrModal({
  isOpen,
  onClose,
  qrCodeImage,
  userName,
}: QrModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="qr-modal">
        <div className="qr-modal__header">
          <h2 className="qr-modal__title">
            {userName ? `QR код - ${userName}` : "QR код"}
          </h2>
        </div>
        <div className="qr-modal__content">
          <img src={qrCodeImage} alt="QR Code" className="qr-modal__image" />
          <p className="qr-modal__hint">
            Отсканируйте код чтобы открыть профиль
          </p>
        </div>
      </div>
    </Modal>
  );
}
