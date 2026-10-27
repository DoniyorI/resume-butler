// A text input that grows with its content (or its placeholder when empty)
export function InputSizer({ placeholder, value, onChange }) {
  const inputSize = value.length > 0 ? value.length : placeholder.length;
  return (
    <label className="input-sizer">
      <input
        type="text"
        className="text-center underline underline-offset-3 cursor-text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        size={inputSize}
        placeholder={placeholder}
        onInput={(e) => (e.target.parentNode.dataset.value = e.target.value)}
      />
    </label>
  );
}
