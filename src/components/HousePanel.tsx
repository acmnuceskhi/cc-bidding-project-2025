import React from "react";
import { House } from "@/lib/models/houses";

interface HousePanelProps {
  house: House;
  onBid: (amount: number) => void;
  disabled: boolean;
}

const HousePanel: React.FC<HousePanelProps> = ({ house, onBid, disabled }) => {
  const [bidAmount, setBidAmount] = React.useState(0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (bidAmount > 0 && bidAmount <= house.remainingBudget) {
      onBid(bidAmount);
      setBidAmount(0);
    }
  };

  return (
    <div className="border rounded-lg p-4 shadow-md bg-white">
      <h3 className="text-xl font-bold mb-2">{house.name}</h3>
      <div className="mb-4">
        <p className="text-gray-600">
          Budget: ${house.remainingBudget} / ${house.totalBudget}
        </p>
        <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
          <div
            className="bg-blue-600 h-2 rounded-full"
            style={{
              width: `${(house.remainingBudget / house.totalBudget) * 100}%`,
            }}
          ></div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-2">
        <div>
          <label
            htmlFor={`bid-${house._id}`}
            className="block text-sm font-medium text-gray-700"
          >
            Place Bid
          </label>
          <input
            type="number"
            id={`bid-${house._id}`}
            min="1"
            max={house.remainingBudget}
            value={bidAmount}
            onChange={(e) => setBidAmount(Number(e.target.value))}
            disabled={disabled}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 p-2 border"
          />
        </div>
        <button
          type="submit"
          disabled={
            disabled || bidAmount <= 0 || bidAmount > house.remainingBudget
          }
          className={`w-full py-2 px-4 rounded-md text-white ${
            disabled || bidAmount <= 0 || bidAmount > house.remainingBudget
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-indigo-600 hover:bg-indigo-700"
          }`}
        >
          Submit Bid
        </button>
      </form>
    </div>
  );
};

export default HousePanel;
