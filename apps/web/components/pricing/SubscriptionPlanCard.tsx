import Link from "next/link";

type Feature = {
  label: string;
  enabled: boolean;
};

type SubscriptionPlanCardProps = {
  title: string;
  subtitle?: string;
  features: Feature[];
  buttonText: string;
  buttonAction: (() => void) | string;
  isActive?: boolean;
  isDisabled?: boolean;
};

export function SubscriptionPlanCard({
  title,
  subtitle,
  features,
  buttonText,
  buttonAction,
  isActive = false,
  isDisabled = false,
}: SubscriptionPlanCardProps) {
  const buttonContent =
    typeof buttonAction === "string" ? (
      <Link
        href={buttonAction}
        className="flex items-center justify-center rounded-[50px] bg-[#D9D9D9] text-black transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{ width: "163px", height: "38px" }}
      >
        {buttonText}
      </Link>
    ) : (
      <button
        onClick={buttonAction}
        disabled={isDisabled || isActive}
        className="flex items-center justify-center rounded-[50px] bg-[#D9D9D9] text-black transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{ width: "163px", height: "38px" }}
      >
        {isActive ? "پلن فعال شما" : buttonText}
      </button>
    );

  return (
    <div className="flex flex-col rounded-2xl bg-white p-6 shadow-lg max-w-[400px] min-w-[284px] w-full">
      {/* Title */}
      <div className="mb-6 text-center">
        <h3 className="text-xl font-bold text-black">{title}</h3>
        {subtitle && (
          <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
        )}
        <div className="mt-4 flex justify-center">
          <svg
            width={200}
            height={10}
            viewBox="0 0 440 12"
            className="h-auto w-full max-w-[200px] text-black"
            aria-hidden="true"
            preserveAspectRatio="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          >

            <path
              d="M8 5.5H432"
              fill="none"
              stroke="currentColor"
              strokeOpacity="0.2"
              strokeWidth="2"
            />
          </svg>
        </div>
      </div>

      {/* Features */}
      <div className="flex-1 space-y-4">
        {features.map((feature, index) => (
          <div key={index} className="flex items-start gap-3 lg:text-sm text-xs">
            <div className="mt-0.5 h-5 w-5 flex-shrink-0">
              {feature.enabled ? (
                <svg
                  width={20}
                  height={20}
                  viewBox="0 0 20 20"
                  className="h-5 w-5 text-black"
                  aria-hidden="true"
                >
                  <path
                    d="M3.5 10.5L7.75 14.75L16.5 5.5"
                    fill="none"
                    stroke="currentColor"
                    strokeOpacity="0.5"
                    strokeWidth="4"
                    strokeLinecap="butt"
                    strokeLinejoin="miter"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
              ) : (
                <svg
                  width={20}
                  height={20}
                  viewBox="0 0 20 20"
                  className="h-5 w-5 text-black"
                  aria-hidden="true"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path
                    d="M4.5 4.5L15.5 15.5"
                    fill="none"
                    stroke="currentColor"
                    strokeOpacity="0.6"
                    strokeWidth="3.5"
                  />
                  <path
                    d="M15.5 4.5L4.5 15.5"
                    fill="none"
                    stroke="currentColor"
                    strokeOpacity="0.6"
                    strokeWidth="3.5"
                  />
                </svg>
              )}
            </div>
            <span className={feature.enabled ? "text-black" : "text-gray-400"}>
              {feature.label}
            </span>
          </div>
        ))}
      </div>

      {/* Button */}
      <div className="mt-6 pt-4 flex justify-center">{buttonContent}</div>
    </div>
  );
}
