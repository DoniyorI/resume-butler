import React, { useState } from "react";

export const InputSizer = ({ placeholder, value, onChange }) => {
  const handleInputChange = (event) => {
    onChange(event.target.value);
  };
  const inputSize = value.length > 0 ? value.length : placeholder.length;
  return (
    <label className="input-sizer">
      <input
        type="text"
        className="text-center underline underline-offset-3"
        value={value}
        onChange={handleInputChange}
        size={inputSize}
        placeholder={placeholder}
        onInput={(e) => (e.target.parentNode.dataset.value = e.target.value)}
      />
    </label>
  );
};
