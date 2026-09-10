import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center font-body">
      <p className="font-display text-6xl text-sindoor">৪০৪</p>
      <h1 className="font-display font-bold text-2xl mt-2">
        <span className="block text-dhunuchi text-base leading-none mb-1">
          এই পণ্ডালটি ম্যাপে নেই
        </span>
        This pandal isn&apos;t on the map
      </h1>
      <p className="text-stone-600 text-sm mt-2">
        The page you&apos;re looking for doesn&apos;t exist — but 31 pujas do.
      </p>
      <Link
        href="/pujas/"
        className="inline-block mt-6 rounded-full bg-sindoor text-white px-6 py-3 font-semibold hover:bg-sindoor-dark transition-colors"
      >
        Browse all pujas
      </Link>
    </div>
  );
}
