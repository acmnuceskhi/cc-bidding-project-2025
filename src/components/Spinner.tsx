"use client";

interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  color?: string;
  className?: string;
}

const Spinner = ({
  size = "md",
  color = "border-yellow-400",
  className = "",
}: SpinnerProps) => {
  const sizeClasses = {
    sm: "w-6 h-6",
    md: "w-12 h-12",
    lg: "w-24 h-24",
  };

  return (
    <div
      className={`animate-spin rounded-full border-4 border-t-transparent ${color} ${sizeClasses[size]} ${className}`}
      role="status"
      aria-live="polite"
      aria-label="Loading"
    ></div>
  );
};

const FullPageSpinner = ({
  message,
  className,
}: {
  message?: string;
  className?: string;
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center h-screen bg-transparent text-white ${className}`}
    >
      <Spinner size="lg" />
      {message && (
        <p className="mt-4 text-xl text-yellow-400 animate-pulse">{message}</p>
      )}
    </div>
  );
};

export { Spinner, FullPageSpinner };
