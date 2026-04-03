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
import { validateMaterialPurchase } from "../validators/materialPurchase.validator";
import { MaterialPurchaseInput } from "../types";
import { useMaterialPurchase } from "../hooks/useMaterialPurchase";

export function MaterialPurchaseEntry() {
  const navigate = useNavigate();
  const { 
    vendors,
    vendorsLoading,
    submitMaterialPurchase,
    loading,
    error,
    materials,
    materialsLoading
  } = useMaterialPurchase();
  const [material, setMaterial] = useState<string>("");
  const [vendor, setVendor] = useState("");
  const [quantity, setQuantity] = useState("");
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [showErrorPopup, setShowErrorPopup] = useState(false);

  const selectedMaterialUnit = materials.find(m => m.id === material)?.unit;

  const handleSubmit = async () => {
    const payload: MaterialPurchaseInput = {
      material_id: material,
      vendor_id: vendor,
      quantity: Number(quantity),
      date: date ? format(date, "yyyy-MM-dd") : "",
    };

    const validationErrors = validateMaterialPurchase(payload);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) return;

    try {
      await submitMaterialPurchase(payload);
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
          <h1 className="text-gray-900">Material Purchase Entry</h1>
          <p className="text-gray-600 mt-1">
            Enter the details of material purchase
          </p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-lg shadow-lg p-6 sm:p-8">
          <div className="space-y-6">
            {/* Material */}
            <div>
              <label htmlFor="material" className="block text-gray-700 mb-2">
                Material <span className="text-red-600">*</span>
              </label>
              <select
                id="material"
                value={material}
                onChange={(e) => { setMaterial(e.target.value); setErrors((prev) => ({ ...prev, material: "" })); }}
                disabled={materialsLoading}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              >
                <option value="">Select Material</option>
                {materials.map((material) => (
                  <option key={material.id} value={material.id}>
                    {material.name}
                  </option>
                ))}
              </select>
              {errors.material && (
                <p className="text-red-600 text-sm mt-1">{errors.material}</p>
              )}
            </div>

            {/* Vendor */}
            <div>
              <label htmlFor="vendor" className="block text-gray-700 mb-2">
                Vendor <span className="text-red-600">*</span>
              </label>
              <select
                value={vendor}
                onChange={(e) => { setVendor(e.target.value); setErrors((prev) => ({ ...prev, vendor: "" })); }}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                disabled={vendorsLoading}
              >
                <option value="">Select Vendor</option>
                {vendors.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.name}
                  </option>
                ))}
              </select>
              {errors.vendor && (
                <p className="text-red-600 text-sm mt-1">{errors.vendor}</p>
              )}
            </div>

            {/* Quantity */}
            <div>
              <label htmlFor="quantity" className="block text-gray-700 mb-2">
                Quantity {material && `(${selectedMaterialUnit})`}{" "}
                <span className="text-red-600">*</span>
              </label>
              <input
                id="quantity"
                type="number"
                value={quantity}
                onChange={(e) => { setQuantity(e.target.value); setErrors((prev) => ({ ...prev, quantity: "" })); }}
                onWheel={(e) => e.currentTarget.blur()}
                placeholder={`Enter quantity${
                  material ? ` in ${selectedMaterialUnit}` : ""
                }`}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                min="0"
                step="0.01"
              />
              {errors.quantity && (
                <p className="text-red-600 text-sm mt-1">{errors.quantity}</p>
              )}
            </div>

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

            {/* Submit Button */}
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 disabled:bg-gray-400 rounded-lg hover:bg-blue-700 transition-colors"
            >
              {loading ? "Submitting..." : "Submit"}
            </button>
          </div>
        </div>
      </div>

      {/* Success Popup */}
      {showSuccessPopup && (
        <Popup
          title="Purchase Successful"
          message="Material purchase entry has been recorded successfully."
          onClose={handlePopupClose}
          type="purchase"
        />
      )}

      {/* Failure Popup */}
      {showErrorPopup && error && (
        <Popup
          title="Submission Failed"
          message={error}
          onClose={() => setShowErrorPopup(false)}
          type="error"
        />
      )}
    </div>
  );
}
