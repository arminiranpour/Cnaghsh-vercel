import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function ProfilesLoading() {
  return (
    <div className="relative w-full min-h-screen" dir="rtl">
      <div className="absolute inset-0 -z-10 bg-[#E5E5E5]" />

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 pt-[100px]">
        <header className="space-y-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </header>

        <Card className="border-border bg-background/60">
          <CardHeader className="pb-4">
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
            <Skeleton className="lg:col-span-2 h-24 w-full" />
          </CardContent>
        </Card>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Card key={index} className="h-48">
              <CardContent className="flex h-full flex-col gap-4 pt-6">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </CardContent>
            </Card>
          ))}
        </section>
      </div>
    </div>
  );
}
