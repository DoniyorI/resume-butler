import {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableFooter,
    TableHead,
    TableHeader,
    TableRow,
  } from "@/components/ui/table";
  import Link from "next/link";
  import { FaRegFilePdf } from "react-icons/fa6";
  import { AiOutlineFilePdf } from "react-icons/ai";
  
  const applications = [
    {
      resume: "John_Doe_Resume.pdf",
      coverLetter: "John_Doe_Cover_Letter.docx",
      companyName: "ABC Company",
      roleStatus: "Interview Scheduled",
      location: "New York, NY",
      dateApplied: "2024-04-01",
      dashboardLink: "https://example.com/dashboard",
      comments: "Great fit for the position",
    },
    {
      resume: "",
      coverLetter: "Jane_Smith_Cover_Letter.pdf",
      companyName: "XYZ Corporation",
      roleStatus: "Pending Review",
      location: "Los Angeles, CA",
      dateApplied: "2024-04-02",
      dashboardLink: "https://example.com/dashboard",
      comments: "Awaiting response",
    },
    {
      resume: "Michael_Jackson_Resume.docx",
      coverLetter: "",
      companyName: "123 Industries",
      roleStatus: "Rejected",
      location: "Chicago, IL",
      dateApplied: "2024-03-29",
      dashboardLink: "https://example.com/dashboard",
      comments: "Position filled",
    },
    {
      resume: "",
      coverLetter: "",
      companyName: "Tech Solutions Inc.",
      roleStatus: "Application Submitted",
      location: "San Francisco, CA",
      dateApplied: "2024-04-03",
      dashboardLink: "https://example.com/dashboard",
      comments: "No response yet",
    },
    {
      resume: "Emily_Roberts_Resume.pdf",
      coverLetter: "Emily_Roberts_Cover_Letter.docx",
      companyName: "GHI Enterprises",
      roleStatus: "Shortlisted",
      location: "Seattle, WA",
      dateApplied: "2024-03-31",
      dashboardLink: "https://example.com/dashboard",
      comments: "Second interview scheduled",
    },
  ];
  
  export default function TableDemo() {
    return (
      <Table>
        <TableCaption>A list of your recent job applications.</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Resume</TableHead>
            <TableHead>Cover Letter</TableHead>
            <TableHead>Company Name</TableHead>
            <TableHead>Role Status</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Date Applied</TableHead>
            <TableHead>Comments</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {applications.map((application, index) => (
            <TableRow key={index}>
              <TableCell className="text-red-700 mx-auto">
                {application.resume ? (
                  <AiOutlineFilePdf className="mx-auto" size={20}/>
                ) : null}
              </TableCell>
              <TableCell className="text-green-700">
                {application.coverLetter ? (
                  <AiOutlineFilePdf className="mx-auto" size={20}/>
                ) : null}
              </TableCell>
              <TableCell>
                <Link className="hover:underline" href={application.dashboardLink} target="_blank" rel="noopener noreferrer">
                  {application.companyName}
                </Link>
              </TableCell>
              <TableCell>{application.roleStatus}</TableCell>
              <TableCell>{application.location}</TableCell>
              <TableCell>{application.dateApplied}</TableCell>
              <TableCell>{application.comments}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }
  