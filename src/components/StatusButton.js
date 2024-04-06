import { Button } from "@/components/ui/button";

const StatusButton = ({ status, onClick }) => {
  let variant = "default";
  let color = "gray-500";

  switch (status) {
    case "in progress":
      variant = "primary";
      color = "blue-500";
      break;
    case "interviewed":
      variant = "primary";
      color = "blue-500";
      break;
    case "rejected":
      variant = "destructive";
      color = "red-500";
      break;
    case "offer":
      variant = "success";
      color = "green-500";
      break;
    default:
      break;
  }

  return (
    <Button
      variant={variant}
      className={`text-${color} hover:text-${color}-700`}
      onClick={onClick}
    >
      {status}
    </Button>
  );
};

export default StatusButton;