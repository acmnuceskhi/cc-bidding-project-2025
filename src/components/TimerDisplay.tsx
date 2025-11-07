import React from "react";

interface TimerDisplayProps {
  timeLeft: number;
  total_time: number;
}

const TimerDisplay: React.FC<TimerDisplayProps> = ({
  timeLeft,
  total_time,
}) => {
  const percentage = (timeLeft / total_time) * 100;

  return (
    <div className="w-full bg-gray-200 rounded-full h-4 mb-4">
      <div
        className="bg-red-600 h-4 rounded-full transition-all duration-1000 ease-linear"
        style={{ width: `${percentage}%` }}
      ></div>
      <div className="text-center text-sm font-medium mt-1">
        Time left: {Math.ceil(timeLeft / 1000)} seconds
      </div>
    </div>
  );
};

export default TimerDisplay;
