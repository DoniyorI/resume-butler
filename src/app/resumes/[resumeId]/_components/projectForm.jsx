import { X } from "lucide-react";
export const ProjectsForm = ({ item, onChange }) => {
  const handleInputChange = (field, e) => {
    const value = e.target.textContent.trim();
    onChange({ [field]: value });
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.target.blur();
    }
  };

  const handleFocus = (e) => {
    if (e.target.textContent === e.target.getAttribute("data-placeholder")) {
      e.target.textContent = "";
    }
  };

  const handleBlur = (e) => {
    const field = e.target.getAttribute("data-field");
    const value = e.target.textContent.trim();
    if (!value) {
      e.target.textContent = e.target.getAttribute("data-placeholder");
      e.target.classList.add("contentEditablePlaceholder");
    } else {
      e.target.classList.remove("contentEditablePlaceholder");
    }
    handleInputChange(field, { target: { textContent: value } });
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString.split(" at ")[0]);
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };
  const handlePaste = (e) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
  };

  const formattedStartDate = formatDate(item.startDate);
  const formattedEndDate = item.currentlyWorking
    ? "Current"
    : formatDate(item.endDate);

  const handleDescriptionChange = (index, value) => {
    const newDescription = [...item.description];
    newDescription[index] = value;
    onChange({ description: newDescription });
  };

  const addDescriptionPointBelow = (index) => {
    const newDescription = [...item.description];
    newDescription.splice(index + 1, 0, "");
    onChange({ description: newDescription });
  };

  const deleteDescriptionPoint = (index) => {
    const newDescription = [...item.description];
    newDescription.splice(index, 1);
    onChange({ description: newDescription });
  };

  return (
    <div className="Project">
      <div className="flex justify-between items-baseline">
        <span
          contentEditable
          className={`input text-sm font-semibold ${
            !item.projectName ? "contentEditablePlaceholder" : ""
          }`}
          role="textbox"
          onFocus={handleFocus}
          onBlur={handleBlur}
          onPaste={handlePaste}
          onKeyDown={handleKeyDown}
          data-placeholder="Enter Project Name"
          data-field="projectName"
          dangerouslySetInnerHTML={{ __html: item.projectName || "" }}
        />

        <span
          contentEditable
          className={`input text-sm font-semibold ${
            !item.endDate && !item.currentlyWorking
              ? "contentEditablePlaceholder"
              : ""
          }`}
          role="textbox"
          onFocus={handleFocus}
          onBlur={handleBlur}
          onPaste={handlePaste}
          onKeyDown={handleKeyDown}
          data-placeholder="Enter End Date"
          data-field="endDate"
          dangerouslySetInnerHTML={{ __html: item.endDate || "" }}
        />
      </div>
      <div className="text-sm flex justify-between">
        <span
          contentEditable
          className={`input text-sm ${
            !item.position ? "contentEditablePlaceholder" : ""
          }`}
          role="textbox"
          onFocus={handleFocus}
          onBlur={handleBlur}
          onPaste={handlePaste}
          onKeyDown={handleKeyDown}
          data-placeholder="Enter Position"
          data-field="position"
          dangerouslySetInnerHTML={{ __html: item.position || "" }}
        />
        <span
          contentEditable
          className={`input italic text-sm ${
            !item.location ? "contentEditablePlaceholder" : ""
          }`}
          role="textbox"
          onFocus={handleFocus}
          onBlur={handleBlur}
          onPaste={handlePaste}
          onKeyDown={handleKeyDown}
          data-placeholder="Enter Location"
          data-field="location"
          dangerouslySetInnerHTML={{ __html: item.location || "" }}
        />
      </div>
      <div className="pl-[22px] mt-1">
        <ul className="list-inside">
          {item.description && item.description.length > 0 ? (
            item.description.map((point, index) => (
              <li key={index} className="text-md flex items-center">
                <span
                  className="bullet-toggle mr-2"
                  onClick={() => addDescriptionPointBelow(index)}
                ></span>
                <div
                  contentEditable
                  className={`input w-full text-sm ${
                    !point ? "contentEditablePlaceholder" : ""
                  }`}
                  role="textbox"
                  onFocus={handleFocus}
                  onPaste={handlePaste}
                  onBlur={(e) =>
                    handleDescriptionChange(index, e.target.textContent)
                  }
                  onKeyDown={handleKeyDown}
                  data-placeholder="Enter Description Detail"
                  dangerouslySetInnerHTML={{ __html: point || "" }}
                />
                <button
                  onClick={() => deleteDescriptionPoint(index)}
                  className="ml-1 cursor-pointer text-red-800 hover:text-red-500"
                >
                  <X size={16} />
                </button>
              </li>
            ))
          ) : (
            <li className="text-sm flex items-center">
              <span
                className="bullet-toggle mr-2"
                onClick={() => addDescriptionPointBelow(0)}
              ></span>
              <div
                contentEditable
                className="input grow text-md contentEditablePlaceholder"
                role="textbox"
                onFocus={handleFocus}
                onPaste={handlePaste}
                onBlur={(e) => handleDescriptionChange(0, e.target.textContent)}
                onKeyDown={handleKeyDown}
                data-placeholder="Enter Description Detail"
              />
              <button
                onClick={() => deleteDescriptionPoint(0)}
                className="ml-1 cursor-pointer text-red-800 hover:text-red-500"
              >
                <X size={16} />
              </button>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
};
