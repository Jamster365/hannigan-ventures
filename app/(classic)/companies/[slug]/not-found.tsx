import { PageHeader } from "@/components/navigation/page-header";
import { EmptyState, LinkButton } from "@/components/ui/primitives";

export default function CompanyNotFound() {
  return (
    <>
      <PageHeader variant="back" title="Not found" backHref="/home" />
      <div className="pt-8">
        <EmptyState
          title="Company not found"
          body="This company is not tracked by the household, or the link is out of date."
          action={
            <LinkButton href="/discover" variant="outline" size="sm">
              Browse companies
            </LinkButton>
          }
        />
      </div>
    </>
  );
}
