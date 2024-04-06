"use client";

import * as React from "react";
import { Check, ChevronsUpDown, PlusCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
// import { Input } from "@/components/ui/input";

const locations = [
  { city: "New York", state: "NY" },
  { city: "Los Angeles", state: "CA" },
  { city: "Chicago", state: "IL" },
  // Add more locations as needed
];

function LocationInput() {
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState("");
  const [customLocation, setCustomLocation] = React.useState("");

  const selectedLocation = value
    ? locations.find(
        (loc) => `${loc.city}, ${loc.state}` === value
      )
    : null;

  const handleCustomLocationSubmit = () => {
    if (customLocation) {
      const [city, state] = customLocation.split(", ");
      setValue(`${city}, ${state}`);
      setCustomLocation("");
      setOpen(false);
    }
  };

  return (
    <div className="grid grid-cols-4 items-center gap-4">
      <label htmlFor="location" className="text-right">
        Location
      </label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="col-span-3 justify-between"
          >
            {selectedLocation
              ? `${selectedLocation.city}, ${selectedLocation.state}`
              : "Select location..."}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0">
          <Command>
            <CommandInput
              placeholder="Search location..."
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleCustomLocationSubmit();
                }
              }}
              value={customLocation}
              onChange={(e) => setCustomLocation(e.target.value)}
            />
            <CommandEmpty>No location found.</CommandEmpty>
            <CommandGroup>
              {locations.map((loc) => (
                <CommandItem
                  key={`${loc.city}-${loc.state}`}
                  value={`${loc.city}, ${loc.state}`}
                  onSelect={(currentValue) => {
                    setValue(currentValue === value ? "" : currentValue);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === `${loc.city}, ${loc.state}`
                        ? "opacity-100"
                        : "opacity-0"
                    )}
                  />
                  {loc.city}, {loc.state}
                </CommandItem>
              ))}
            </CommandGroup>
            <div className="border-t border-gray-200 px-4 py-2">
              <Button
                variant="default"
                className="w-full"
                onClick={handleCustomLocationSubmit}
              >
                <PlusCircle className="mr-2 h-4 w-4" /> Add "{customLocation}"
              </Button>
            </div>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default LocationInput;