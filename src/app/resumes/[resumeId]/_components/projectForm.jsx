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

  const formattedStartDate = formatDate(item.startDate);
  const formattedEndDate = item.currentlyWorking
    ? "Current"
    : formatDate(item.endDate);

  return (
    <div className="Project">
      <div className="flex justify-between items-baseline">
        <span
          contentEditable
          className={`input text-sm ${
            !item.projectName ? "contentEditablePlaceholder" : ""
          }`}
          role="textbox"
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          data-placeholder="Enter Project Name"
          data-field="projectName"
          dangerouslySetInnerHTML={{ __html: item.projectName || "" }}
        />

        <span
          contentEditable
          className={`input text-sm ${
            !item.endDate && !item.currentlyWorking
              ? "contentEditablePlaceholder"
              : ""
          }`}
          role="textbox"
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          data-placeholder="Enter End Date"
          data-field="endDate"
          dangerouslySetInnerHTML={{ __html: formattedEndDate || "" }}
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
          onKeyDown={handleKeyDown}
          data-placeholder="Enter Location"
          data-field="location"
          dangerouslySetInnerHTML={{ __html: item.location || "" }}
        />
      </div>
      <div className="ml-[22px]">
        <ul className="list-disc list-inside">
          {item.description && item.description.length > 0 ? (
            item.description.map((point, index) => (
              <li
                key={index}
                className="text-sm"
                contentEditable
                onFocus={handleFocus}
                onBlur={(e) =>
                  handleDescriptionChange(index, e.target.textContent)
                }
                onKeyDown={handleKeyDown}
                data-placeholder="Enter Description Detail"
                dangerouslySetInnerHTML={{
                  __html: point || "Add description detail",
                }}
              ></li>
            ))
          ) : (
            <li className="text-sm">No details available.</li>
          )}
        </ul>
      </div>
    </div>
  );
};
