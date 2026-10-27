import Link from "next/link";
import { FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function DocumentLink({ href, label, iconClassName }) {
  return (
    <Link href={href}>
      <div className="flex items-center gap-2 p-2 rounded-md border hover:bg-gray-50 cursor-pointer">
        <FileText size={14} className={iconClassName} />
        <span className="text-sm">{label}</span>
      </div>
    </Link>
  );
}

export default function LinkedDocuments({ resumeId, coverLetterId }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <FileText size={16} /> Documents
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {resumeId ? (
          <DocumentLink href={`/resumes/${resumeId}`} label="View Resume" iconClassName="text-blue-600" />
        ) : (
          <p className="text-sm text-gray-400">No resume linked</p>
        )}
        {coverLetterId ? (
          <DocumentLink
            href={`/coverletters/${coverLetterId}`}
            label="View Cover Letter"
            iconClassName="text-green-600"
          />
        ) : (
          <p className="text-sm text-gray-400">No cover letter linked</p>
        )}
      </CardContent>
    </Card>
  );
}
