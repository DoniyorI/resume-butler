"use client";

import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { INSIGHT_TABS } from "@/features/dashboard/insightTabs";

// The tab lives in the URL (?tab=), so it can be shared and the back button steps through it.
// The server renders only the active tab's content and passes it in as children.
export default function InsightsTabs({ tab, children }) {
  const router = useRouter();
  return (
    <Tabs
      value={tab}
      onValueChange={(value) => router.push(value === INSIGHT_TABS[0].value ? "/insights" : `/insights?tab=${value}`, { scroll: false })}
      className="w-full"
    >
      <TabsList className="h-auto max-w-full flex-wrap justify-start">
        {INSIGHT_TABS.map((item) => (
          <TabsTrigger key={item.value} value={item.value}>
            {item.label}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value={tab} className="mt-4">
        {children}
      </TabsContent>
    </Tabs>
  );
}
