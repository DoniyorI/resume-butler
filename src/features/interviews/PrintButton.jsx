"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PrintButton() {
  return (
    <Button type="button" variant="outline" size="sm" className="rb-no-print" onClick={() => window.print()}>
      <Printer className="mr-1.5 h-3.5 w-3.5" /> Print
    </Button>
  );
}
