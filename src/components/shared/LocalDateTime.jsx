"use client";

import { useEffect, useState } from "react";
import { format as formatDate } from "date-fns";

const FORMATS = {
  date: (d) => d.toLocaleDateString("en-US"),
  datetime: (d) => d.toLocaleString(),
  long: (d) => formatDate(d, "MMM d, yyyy 'at' h:mm a"),
};

// Formats a timestamp in the viewer's time zone. It renders after mount because
// the server's time zone would differ and cause a hydration mismatch.
export default function LocalDateTime({ value, format = "datetime", className }) {
  const [text, setText] = useState("");

  useEffect(() => {
    setText(value ? FORMATS[format](new Date(value)) : "");
  }, [value, format]);

  return (
    <time dateTime={value || undefined} className={className}>
      {text}
    </time>
  );
}
