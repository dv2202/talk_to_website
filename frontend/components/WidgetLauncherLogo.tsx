const SHARED_LAUNCHER_BG = "#2678FF";

function normalizeHex(color: string): string {
    return color.trim().toLowerCase();
}

/** True for white / near-empty — old default that hides the shared SVG. */
function isUnsetLauncherBg(color: string | null | undefined): boolean {
    if (!color) return true;
    const c = normalizeHex(color);
    return c === "#fff" || c === "#ffffff" || c === "white";
}

/** Bubble fill: shared blue when no custom logo and bg is white/unset. */
export function resolveWidgetLauncherBg(
    bgColor: string | null | undefined,
    logoUrl?: string | null
): string {
    if (logoUrl) return bgColor || SHARED_LAUNCHER_BG;
    if (isUnsetLauncherBg(bgColor)) return SHARED_LAUNCHER_BG;
    return bgColor as string;
}

/** Shared launcher SVG — matches the shared blue chat-card image when no custom logo. */
export function WidgetLauncherLogo({
    bgColor = SHARED_LAUNCHER_BG,
    logoUrl,
    size = 56,
    className,
}: {
    bgColor?: string;
    logoUrl?: string | null;
    size?: number;
    className?: string;
}) {
    const fill = resolveWidgetLauncherBg(bgColor, logoUrl);
    const centerSize = Math.round(size * 0.5);

    return (
        <div
            className={`relative flex items-center justify-center shrink-0 select-none ${className ?? ""}`}
            style={{ width: size, height: size }}
        >
            {logoUrl ? (
                <>
                    <svg
                        width={size}
                        height={size}
                        viewBox="0 0 60 60"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        className="absolute inset-0 h-full w-full drop-shadow-md pointer-events-none"
                        aria-hidden="true"
                    >
                        <path
                            d="M26 4H48C53.76 4 56 6.24 56 10V30C56 42.15 46.15 52 34 52H26C13.85 52 4 42.15 4 30V26C4 13.85 13.85 4 26 4Z"
                            fill={fill}
                        />
                    </svg>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={logoUrl}
                        alt=""
                        className="relative z-10 rounded-full object-cover shadow-sm pointer-events-none"
                        style={{
                            width: centerSize,
                            height: centerSize,
                            backgroundColor: fill,
                        }}
                    />
                </>
            ) : (
                <svg
                    width={size}
                    height={size}
                    viewBox="0 0 60 60"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-full w-full drop-shadow-md pointer-events-none"
                    aria-hidden="true"
                >
                    <path
                        d="M26 4H48C53.76 4 56 6.24 56 10V30C56 42.15 46.15 52 34 52H26C13.85 52 4 42.15 4 30V26C4 13.85 13.85 4 26 4Z"
                        fill={fill}
                    />
                    <rect x="18" y="20" width="24" height="20" rx="5" fill="#ffffff" />
                    <rect x="22.5" y="26" width="15" height="3" rx="1.5" fill={fill} />
                    <rect x="22.5" y="32.5" width="9" height="3" rx="1.5" fill={fill} />
                </svg>
            )}
        </div>
    );
}
