import React, { useState } from "react";
import { ArrowLeft, CalendarIcon } from "lucide-react";
import { Popup } from "../../components/Popup";
import { Calendar } from "../../components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../components/ui/popover";
import { format } from "date-fns";
import { cn } from "../../components/ui/utils";
import { useNavigate } from "react-router-dom";
import { useProduction } from "../hooks/useProduction";
import { ProductionInput } from "../types";
import { validateProduction } from "../validators/production.validator";

export function ProductionEntry() {
  const navigate = useNavigate();
  const { submitProduction, loading, error } = useProduction();

  const [date, setDate] = useState<Date | undefined>(new Date());
  const [round, setRound] = useState("");
  const [bricks, setBricks] = useState("");
  const [wetAsh, setWetAsh] = useState("");
  const [marblePowder, setMarblePowder] = useState("");
  const [crusherPowder, setCrusherPowder] = useState("");
  const [flyAsh, setFlyAsh] = useState("");
  const [cement, setCement] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [showErrorPopup, setShowErrorPopup] = useState(false);

  const handleSubmit = async () => {
    const payload: ProductionInput = {
      date: date ? format(date, "yyyy-MM-dd") : "",
      round: round === "" ? NaN : Number(round),
      bricks: Number(bricks),
      wetAsh: Number(wetAsh),
      marblePowder: Number(marblePowder),
      crusherPowder: Number(crusherPowder),
      flyAsh: Number(flyAsh),
      cement: Number(cement),
    };

    const validationErrors = validateProduction(payload);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) return;

    try {
      await submitProduction(payload);
      setShowSuccessPopup(true);
    } catch {
      setShowErrorPopup(true);
    }
  };

  const handlePopupClose = () => {
    setShowSuccessPopup(false);
    navigate("/employee/home");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate("/employee/home")}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Home
          </button>
          <h1 className="text-gray-900">Production Entry</h1>
          <p className="text-gray-600 mt-1">
            Enter the production details for today
          </p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-lg shadow-lg p-6 sm:p-8">
          <div className="space-y-6">
            {/* Date */}
            <div>
              <label htmlFor="date" className="block text-gray-700 mb-2">
                Date <span className="text-red-600">*</span>
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-left",
                      !date && "text-gray-400"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span>
                        {date ? format(date, "PPP") : "Select a date"}
                      </span>
                      <CalendarIcon className="w-5 h-5 text-gray-400" />
                    </div>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(d: Date | undefined) => { setDate(d); setErrors((prev) => ({ ...prev, date: "" })); }}
                    disabled={(date: Date) => date > new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {errors.date && (
                <p className="text-red-600 text-sm mt-1">{errors.date}</p>
              )}
            </div>

            {/* Round */}
            <div>
              <label htmlFor="round" className="block text-gray-700 mb-2">
                Round <span className="text-red-600">*</span>
              </label>
              <input
                id="round"
                type="number"
                value={round}
                onChange={(e) => { setRound(e.target.value); setErrors((prev) => ({ ...prev, round: "" })); }}
                onWheel={(e) => e.currentTarget.blur()}
                placeholder="Enter round number (max 99)"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                min="0"
                max="99"
              />
              {errors.round && (
                <p className="text-red-600 text-sm mt-1">{errors.round}</p>
              )}
            </div>

            {/* Bricks */}
            <div>
              <label htmlFor="bricks" className="block text-gray-700 mb-2">
                Bricks <span className="text-red-600">*</span>
              </label>
              <input
                id="bricks"
                type="number"
                value={bricks}
                onChange={(e) => setBricks(e.target.value)}
                onWheel={(e) => e.currentTarget.blur()}
                placeholder="Enter number of bricks"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                min="0"
              />
              {errors.bricks && (
                <p className="text-red-600 text-sm mt-1">{errors.bricks}</p>
              )}
            </div>

            {/* Wet Ash */}
            <div>
              <label htmlFor="wetAsh" className="block text-gray-700 mb-2">
                Wet Ash (Kg) <span className="text-red-600">*</span>
              </label>
              <input
                id="wetAsh"
                type="number"
                value={wetAsh}
                onChange={(e) => setWetAsh(e.target.value)}
                onWheel={(e) => e.currentTarget.blur()}
                placeholder="Enter wet ash in Kg"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                min="0"
                step="0.01"
              />
              {errors.wetAsh && (
                <p className="text-red-600 text-sm mt-1">{errors.wetAsh}</p>
              )}
            </div>

            {/* Marble Powder */}
            <div>
              <label
                htmlFor="marblePowder"
                className="block text-gray-700 mb-2"
              >
                Marble Powder (Kg) <span className="text-red-600">*</span>
              </label>
              <input
                id="marblePowder"
                type="number"
                value={marblePowder}
                onChange={(e) => setMarblePowder(e.target.value)}
                onWheel={(e) => e.currentTarget.blur()}
                placeholder="Enter marble powder in Kg"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                min="0"
                step="0.01"
              />
              {errors.marblePowder && (
                <p className="text-red-600 text-sm mt-1">
                  {errors.marblePowder}
                </p>
              )}
            </div>

            {/* Crusher Powder */}
            <div>
              <label
                htmlFor="crusherPowder"
                className="block text-gray-700 mb-2"
              >
                Crusher Powder (Kg) <span className="text-red-600">*</span>
              </label>
              <input
                id="crusherPowder"
                type="number"
                value={crusherPowder}
                onChange={(e) => setCrusherPowder(e.target.value)}
                onWheel={(e) => e.currentTarget.blur()}
                placeholder="Enter crusher powder in Kg"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                min="0"
                step="0.01"
              />
              {errors.crusherPowder && (
                <p className="text-red-600 text-sm mt-1">
                  {errors.crusherPowder}
                </p>
              )}
            </div>

            {/* Fly Ash */}
            <div>
              <label htmlFor="flyAsh" className="block text-gray-700 mb-2">
                Fly Ash (Kg) <span className="text-red-600">*</span>
              </label>
              <input
                id="flyAsh"
                type="number"
                value={flyAsh}
                onChange={(e) => setFlyAsh(e.target.value)}
                onWheel={(e) => e.currentTarget.blur()}
                placeholder="Enter fly ash in Kg"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                min="0"
                step="0.01"
              />
              {errors.flyAsh && (
                <p className="text-red-600 text-sm mt-1">{errors.flyAsh}</p>
              )}
            </div>

            {/* Cement */}
            <div>
              <label htmlFor="cement" className="block text-gray-700 mb-2">
                Cement (Bags) <span className="text-red-600">*</span>
              </label>
              <input
                id="cement"
                type="number"
                value={cement}
                onChange={(e) => setCement(e.target.value)}
                onWheel={(e) => e.currentTarget.blur()}
                placeholder="Enter cement in Bags"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                min="0"
                step="0.01"
              />
              {errors.cement && (
                <p className="text-red-600 text-sm mt-1">{errors.cement}</p>
              )}
            </div>

            {/* Submit Button */}
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full bg-blue-600 disabled:bg-gray-400 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
              {loading ? "Submitting..." : "Submit"}
            </button>
          </div>
        </div>
      </div>

      {/* Success Popup */}
      {showSuccessPopup && (
        <Popup
          title="Production Entry Successful"
          message="Production details have been entered successfully."
          onClose={handlePopupClose}
          type="production"
        />
      )}

      {/* Failure Popup */}
      {showErrorPopup && (
        <Popup
          title="Submission Failed"
          message={error ?? "Something went wrong"}
          onClose={() => setShowErrorPopup(false)}
          type="error"
        />
      )}
    </div>
  );
}
