import { Card, CardContent, CardHeader } from "../ui/Card";
import { Skeleton } from "../ui/Skeleton";

type PageHeaderSkeletonProps = {
  withAction?: boolean;
  withBadge?: boolean;
};

export function PageHeaderSkeleton({ withAction = true, withBadge = false }: PageHeaderSkeletonProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-2">
        {withBadge && <Skeleton className="h-5 w-24 rounded-lg" />}
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      {withAction && <Skeleton className="h-10 w-full sm:w-36 rounded-lg" />}
    </div>
  );
}

type StatCardsSkeletonProps = {
  count?: number;
  className?: string;
};

export function StatCardsSkeleton({ count = 4, className = "grid grid-cols-2 sm:grid-cols-4 gap-3" }: StatCardsSkeletonProps) {
  return (
    <div className={className}>
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4 space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-16" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

type FilterBarSkeletonProps = {
  rows?: number;
};

export function FilterBarSkeleton({ rows = 2 }: FilterBarSkeletonProps) {
  return (
    <div className="p-4 space-y-3 border-b border-slate-100 dark:border-slate-800/80">
      <Skeleton className="h-10 w-full rounded-lg" />
      {rows > 1 && (
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-9 w-32 rounded-lg" />
          <Skeleton className="h-9 w-28 rounded-lg" />
          <Skeleton className="h-9 w-36 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>
      )}
    </div>
  );
}

type TableSkeletonProps = {
  rows?: number;
};

export function TableSkeleton({ rows = 6 }: TableSkeletonProps) {
  return (
    <div className="p-4 space-y-3">
      <Skeleton className="h-9 w-full rounded-lg" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-lg" />
      ))}
    </div>
  );
}

type ListPageSkeletonProps = {
  statCount?: number;
  statGridClassName?: string;
  tableRows?: number;
  filterRows?: number;
  withBadge?: boolean;
};

export function ListPageSkeleton({
  statCount = 4,
  statGridClassName,
  tableRows = 6,
  filterRows = 2,
  withBadge = false,
}: ListPageSkeletonProps) {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withBadge={withBadge} />
      <StatCardsSkeleton count={statCount} className={statGridClassName} />
      <Card className="shadow-sm overflow-hidden">
        <FilterBarSkeleton rows={filterRows} />
        <TableSkeleton rows={tableRows} />
      </Card>
    </div>
  );
}

export function CustomersPageSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <Card>
        <CardContent className="p-4">
          <Skeleton className="h-10 w-full rounded-lg" />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          <TableSkeleton rows={8} />
        </CardContent>
      </Card>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-32 rounded-lg" />
      </div>

      <StatCardsSkeleton
        count={5}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5"
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Skeleton className="h-80 rounded-xl lg:col-span-2" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </div>
  );
}

export function BillingPageSkeleton() {
  return (
    <div className="space-y-6 pb-20 md:pb-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
        <div className="space-y-2">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-10 w-64 rounded-xl" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          {[1, 2, 3].map((step) => (
            <Card key={step}>
              <CardHeader className="pb-3">
                <Skeleton className="h-5 w-40" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-10 w-full rounded-lg" />
                <div className="grid grid-cols-2 gap-3">
                  <Skeleton className="h-10 w-full rounded-lg" />
                  <Skeleton className="h-10 w-full rounded-lg" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-12 w-full rounded-lg mt-4" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function SettingsPageSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withAction={false} />
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-4 w-60" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-20 w-full rounded-lg" />
        </CardContent>
      </Card>
    </div>
  );
}
