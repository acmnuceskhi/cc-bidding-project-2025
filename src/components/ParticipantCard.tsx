import React from "react";
import { Participant } from "@/lib/models/participants";

interface ParticipantCardProps {
  participant: Participant;
  isActive: boolean;
  timeLeft?: number;
  currentBids?: { houseName: string; amount: number }[];
}

const ParticipantCard: React.FC<ParticipantCardProps> = ({
  participant,
  isActive,
  timeLeft,
  currentBids,
}) => {
  return (
    <div
      className={`border rounded-lg p-4 shadow-md ${isActive ? "border-green-500 bg-green-50" : "border-gray-200"}`}
    >
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">{participant.name}</h3>
        {isActive && timeLeft !== undefined && (
          <span className="bg-red-500 text-white rounded-full px-2 py-1 text-sm">
            {Math.ceil(timeLeft / 1000)}s
          </span>
        )}
      </div>

      {isActive && (
        <div className="mt-4">
          <h4 className="font-medium mb-2">Current Bids:</h4>
          {currentBids && currentBids.length > 0 ? (
            <ul className="space-y-1">
              {currentBids.map((bid, index) => (
                <li key={index} className="flex justify-between text-sm">
                  <span>{bid.houseName}</span>
                  <span className="font-medium">${bid.amount}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500 text-sm">No bids yet</p>
          )}
        </div>
      )}
    </div>
  );
};

export default ParticipantCard;
