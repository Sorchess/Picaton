import "./Loader.scss";

interface LoaderProps {
  fullScreen?: boolean;
  className?: string;
}

export function Loader({ fullScreen = false, className = "" }: LoaderProps) {
  const classNames = ["loader", fullScreen && "loader--fullscreen", className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classNames}>
      <div className="loader__dots">
        <div className="loader__dot" />
        <div className="loader__dot" />
        <div className="loader__dot" />
      </div>
    </div>
  );
}
