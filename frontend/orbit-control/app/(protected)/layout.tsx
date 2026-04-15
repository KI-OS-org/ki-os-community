import { OrbitSidebar } from "@/components/orbit/orbit-sidebar";
import { OrbitHeader }  from "@/components/orbit/orbit-header";
import { CommandPalette } from "@/components/home/command-palette";
import { SearchModal } from "@/components/orbit/search-modal";
import { GhostProvider } from "@/lib/ghost/GhostContext";
import { GhostOverlay } from "@/components/ghost/GhostOverlay";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <GhostProvider>
      <div className="orbit-layout-bg min-h-screen p-4 xl:p-6">
        <div className="mx-auto flex max-w-[1680px] gap-4 xl:gap-6">
          <OrbitSidebar />
          <main className="min-w-0 flex-1 space-y-4 xl:space-y-6">
            <OrbitHeader />
            {children}
          </main>
        </div>
        <CommandPalette />
        <SearchModal />
      </div>
      <GhostOverlay />
    </GhostProvider>
  );
}
