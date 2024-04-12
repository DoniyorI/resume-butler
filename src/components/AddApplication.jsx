"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "./ui/badge";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const locations = [
  { city: "New York", state: "NY" },
  { city: "Los Angeles", state: "CA" },
  { city: "Chicago", state: "IL" },
];

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export default function AddApplicationDialog() {
  const [resume, setResume] = useState("");
  const [coverLetter, setCoverLetter] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [portalLink, setPortalLink] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [location, setLocation] = useState("");
  const [date, setDate] = useState(new Date());
  const [comments, setComments] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleSave = () => {
    console.log({
      resume,
      coverLetter,
      companyName,
      portalLink,
      jobDescription,
      role,
      status,
      location,
      date,
      comments,
    });
    setIsDialogOpen(false);
  };

  const statuses = [
    { label: "Applied", value: "applied" },
    { label: "Interviewed", value: "interviewed" },
    { label: "Pending", value: "pending" },
    { label: "Offered", value: "offered" },
    { label: "Rejected", value: "rejected" },
    { label: "Withdrew", value: "withdrew" },
  ];

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" onClick={() => setIsDialogOpen(true)}>
          Add Application
        </Button>
      </DialogTrigger>
      <DialogContent className="lg:min-w-[60vw]">
        <DialogHeader>
          <DialogTitle>New Application</DialogTitle>
          <DialogDescription>
            Fill in the application details and click save.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[70vh] w-full px-3 rounded-md border">
          <div className="grid gap-4 py-3 mx-1">
            <div className="flex gap-4">
              <div className="flex-grow">
                <Label htmlFor="resume" className="text-right">
                  Resume
                </Label>
                <Input
                  id="resume"
                  type="file"
                  value={resume}
                  onChange={(e) => setResume(e.target.value)}
                  className="col-span-3"
                />
              </div>
              <div className="flex-grow">
                <Label htmlFor="cover-letter" className="text-right">
                  Cover Letter
                </Label>
                <Input
                  id="cover-letter"
                  type="file"
                  value={coverLetter}
                  onChange={(e) => setCoverLetter(e.target.value)}
                  className="col-span-3"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="company-name" className="text-right">
                Company Name
              </Label>
              <Input
                id="company-name"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="col-span-3"
              />
            </div>
            <div>
              <Label htmlFor="portal-Link" className="text-right">
                Portal Link
              </Label>
              <Input
                id="portal-link"
                type="url"
                value={portalLink}
                onChange={(e) => setPortalLink(e.target.value)}
                className="col-span-3"
              />
            </div>
            <div>
              <Label htmlFor="job-description" className="text-right">
                Job Description
              </Label>
              <Textarea
                id="company-name"
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                className="col-span-3"
              />
            </div>
            <div className="flex justify-between space-x-4">
              <div className="w-full">
                <Label htmlFor="role" className="text-right">
                  Role
                </Label>
                <Input
                  id="role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="col-span-3"
                />
              </div>
              <div className="">
                <Label htmlFor="status" className="text-right">
                  Status
                </Label>
                <Select>
                  <SelectTrigger
                    id="status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-[180px]"
                  >
                    <SelectValue placeholder="Select Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {statuses.map((status) => (
                        <SelectItem key={status.label} value={status.value}>
                          <Badge variant={status.value.toLowerCase()}>{status.label}</Badge>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="location" className="text-right">
                Location
              </Label>
              <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="col-span-3"
              />
            </div>
            <div>
              <Label htmlFor="date-picker" className="text-right">
                Date
              </Label>
              <div className="col-span-3">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="date-picker"
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(date, "PPP")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={setDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div>
              <Label htmlFor="comments" className="text-right">
                Comments
              </Label>
              <Input
                id="comments"
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                className="col-span-3"
              />
            </div>
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button type="button" onClick={handleSave}>
            Add Application
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
