import { TaskChooseOrganization } from "@clerk/nextjs";
import { hideCreateOrganizationElements } from "../../../lib/clerk-appearance";

export default function ChooseOrganizationTaskPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <TaskChooseOrganization
        redirectUrlComplete="/"
        appearance={{
          elements: hideCreateOrganizationElements,
        }}
      />
    </div>
  );
}
