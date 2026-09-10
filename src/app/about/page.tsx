import type { Metadata } from "next";
import { city } from "../../lib/pujas";
import Link from "next/link";
import { meta, pujas } from "../../lib/pujas";
import {
  AlponaDivider,
  KaashPhool,
  Shiuli,
  Toran,
} from "../../components/motifs";
import PotrikaFrame from "../../components/PotrikaFrame";

export const metadata: Metadata = {
  title: "About — প্রবাসে পূজা",
  description:
    "A letter from a fellow probashi Bengali: what Durga Puja means far from home, how this guide came to be, and how organizers can send corrections.",
};

const DATA_REPO_URL = city.dataRepoUrl;

const BN_STORY: { head: string; paras: string[] }[] = [
  {
    head: "ষোলো আনা বাঙালিয়ানা — প্রবাসে",
    paras: [
      "বাঙালিয়ানা জিনিসটা আসলে কোথায় থাকে? ঠিক কোনও শহরে নয়। ওটা থাকে শরতের ভোরে শিউলি ফুলের গন্ধে, মহালয়ার ভোরে বেতারে বাজতে থাকা মহিষাসুরমর্দিনীর সুরে, কাশফুলের সাদা ঢেউয়ে। সারাবছর অপেক্ষা — তারপর সেই চার দিন: নতুন জামা, ঢাকের তালে হাততালি, পণ্ডেল হপিং, ভোগের খিচুড়ি আর পায়েস, অষ্টমীর সন্ধ্যার সন্ধিপূজায় শাঁখ আর ঘণ্টাধ্বনি, বিজয়ার দিন বড়দের পায়ে হাত দিয়ে কোলাকুলি। ছেলেবেলায় ঠাকুরের সামনে দাঁড়িয়ে আধভাঙা প্রণাম — চোখ বন্ধ করলেই আজও সব ফিরে আসে।",
      "আর আমরা? আমরা প্রবাসী। সাত সমুদ্র পারে, সানফ্রান্সিস্কোর কুয়াশার শহরে। এখানে শরত আসে ঠিক আছে, কিন্তু শিউলি ফোটে না, কাশ দোলে না কোথাও। তিথি মেনে পূজা হয় না — হয় উইকেন্ডের ছুটির দিনে, প্রবাসীর ক্যালেন্ডার মেনে। অক্টোবরের এক সকালে হঠাৎ মনে পড়ে — আজ যে ষষ্ঠী! আর বুকের ভেতর কেমন খালি খালি লাগে, যেন কেউ চুরি করে নিয়ে গেছে বারো বছরের সব পূজার ছুটির দিন। মাকে ফোন করলে ওনারা বলেন, ‘‘তোর জামাটা কিনে রেখেছিলাম বুঝলি…’’ — আর আমরা অফিসের মিটিংয়ের মাঝে ক্যালেন্ডারে ‘‘অষ্টমী’’ লিখে রাখি, নিজেকে কথা দিয়ে — একটা আরতি হলেও দেখব।",
      "তারপর এক বছর রওনা দিলাম। গাড়ি চালিয়ে পাঁচ-ছয় ঘণ্টা, গন্তব্য এক হাইস্কুলের অডিটোরিয়াম — মনে হচ্ছিল, এ কী! এ তো সাধারণ জায়গা! কিন্তু ভেতরে ঢুকতেই ঘণ্টা আর শাঁখের আওয়াজ, ধুপ-ধোঁয়ার গন্ধে মেশানো ঘি-পোড়া প্রণামের গন্ধ, লাল-সাদা পরা মেয়েরা, ধুতি-পাঞ্জাবিতে লাঞ্চ-কুপন হাতে সদস্যভূক্ত হওয়ার ফন্দি আঁটা মেসোমশাইয়েরা, আর সবচেয়ে মিষ্টি দৃশ্য — মিনি-শাড়ি আর মিনি-ধুতি পরা ছোট্টরা, ভোগের খিচুড়ির বদলে পিজা চিবোতে চিবোতে দৌড়চ্ছে। কারও সাড়িতে পা দিয়ে হাসিমুখে ক্ষমা চাইলেন এক মাসিমা — সেই মুহূর্তেই মনে হলো, হ্যাঁ, এ জায়গা আমার চেনা। হাজার মাইল দূরের এই হাইস্কুলের হলঘরে বাঙালিয়ানা গিয়ে বসেছে গোটা পাল্টা জমিতে, এক ফোঁড়ে।",
      "মনে পড়ে, প্রণাম সরিয়ে ফেলার পর মায়ের ফোনে গলাটা একটু কেঁপে যেত — ‘‘কী রে, জামা কত হলো এবার?’’ খোঁজা হতো কতটা। সেই একই প্রশ্ন এখানেও শুনি, ইংরেজিতে, বাংলায়, আর মাঝেমাঝে দুই ভাষার খিচুড়ি মিশিয়ে। পুরোহিত মশাই সপ্তাহে নয়টা-পাঁচটা সফটওয়্যার ইঞ্জিনিয়ার, কিন্তু মন্ত্রের সুরে সেই একই নিপুণতা। ঢাকি এক আমেরিকান, অথচ তালে কোনও গরবিষেধ নেই। সারা পৃথিবীতে ছড়িয়ে থাকা বাঙালি নিজের ছোট্ট জায়গাটা করে নিয়েছে সেখানেই, যেখানে সে আছে — আর প্রতি শরতে সেই জায়গায় মা এসে বসেন।",
    ],
  },
  {
    head: "পুজো পরিক্রমা — এই পাতাটা কেন",
    paras: [
      "সমস্যা একটাই ছিল। এই শহরে এই উপসাগর জুড়ে ছড়িয়ে আছে " +
        pujas.length +
        "টি পূজা — কোথায় কোন পূজা, কবে পুষ্পাঞ্জলি, কোথায় ভোগ বিক্রি, কোন রাতে চন্দ্রবিন্দুর গান — জানতে হলে ঘাঁটতে হত ডজনখানেক ওয়েবসাইট আর ফেসবুক পেজ। প্রবাসের অল্প ক’টা ছুটির দিন এভাবে রিসার্চে কেটে যায় — এটা কোনও বাঙালির পক্ষে মেনে নেওয়া সম্ভব নয়। তাই এই চেষ্টা — সমস্ত পূজা এক ঠিকানায়: তালিকা, সময়সূচি, ভোগের খোঁজ, টিকিটের লিঙ্ক, আর নিজের সময় মিলিয়ে একদিনে কয়েকটা পূজা ঘোরার পরিক্রমা-পরিকল্পনা — যেন আপনি দিনটা রিসার্চে নয়, ঢাকের তালে কাটান।",
      "আর এই পত্রিকা-পাতা? এটা আমাদেরই — প্রবাসী বাঙালিদের। পূজা আমাদের মনে করিয়ে দেয়, শিকড় কত দূরে গেলেও হারায় না; ছেলেবেলার সেই আনন্দ — নতুন জামা, মিষ্টির লম্বা লাইন, ঠাকুরের সামনে আধভাঙা প্রণাম — চাইলেই ফিরে আসে, সাত সমুদ্র পারেও। কাশফুল না থাক, শিউলি না ফুটুক — ঢাক যেখানে বাজে, সেখানেই তো বাংলা। মা এসেছেন; আমরাও বাড়ি ফিরেছি, প্রশান্ত মহাসাগরের এপারের এই বাড়িতেই। শুভ পূজা, প্রবাসী।",
    ],
  },
];

const BADGES: { title: string; bn: string; desc: string }[] = [
  {
    title: "Schedule published",
    bn: "সময়সূচি প্রকাশিত",
    desc: "The organizer has posted a full timed schedule; we've copied it in.",
  },
  {
    title: "Details partial",
    bn: "আংশিক তথ্য",
    desc: "Dates/venue known, but the detailed schedule, bhog, or entry info isn't published yet.",
  },
  {
    title: "Dates TBA",
    bn: "তারিখ আসেনি",
    desc: "The organizer hasn't announced 2026 dates; the listing links to their site or page for updates.",
  },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 font-body">
      <PotrikaFrame>
        {BN_STORY.map((sec) => (
          <section key={sec.head} className="mt-10 first:mt-8">
            <h2 className="font-display font-bold text-2xl text-sindoor-dark text-center">
              {sec.head}
            </h2>
            <AlponaDivider className="text-dhunuchi/50 my-5" units={20} />
            {sec.paras.map((p, i) => (
              <p
                key={i}
                className="text-ink/85 text-[15px] sm:text-base leading-[1.9] mt-4 text-justify hyphens-auto"
              >
                {p}
              </p>
            ))}
          </section>
        ))}
        <p className="mt-10 text-center font-display text-dhunuchi">
          — শুভ ষষ্ঠী! শুভ দুর্গাপূজা ২০২৬ —
        </p>
      </PotrikaFrame>

      <Toran className="text-sona/70 -mt-1" />

      {/* Badges */}
      <section className="mt-10">
        <h2 className="font-display font-bold text-2xl">
          <span className="block text-dhunuchi text-lg leading-none mb-1">
            চিহ্নগুলোর মানে
          </span>
          How to read the badges
        </h2>
        <ul className="mt-4 space-y-3">
          {BADGES.map((b) => (
            <li
              key={b.title}
              className="bg-white border border-stone-200 rounded-2xl p-4 flex flex-wrap items-baseline gap-x-3"
            >
              <span className="text-xs font-semibold uppercase tracking-wide bg-stone-100 text-stone-600 rounded-full px-2 py-0.5">
                {b.title}
              </span>
              <span className="font-display text-sm text-dhunuchi">
                {b.bn}
              </span>
              <p className="w-full text-sm text-stone-600 mt-1">{b.desc}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Caveats */}
      <section className="mt-8">
        <h2 className="font-display font-bold text-2xl">
          <span className="block text-dhunuchi text-lg leading-none mb-1">
            একটু দেখে নিও
          </span>
          A few honest caveats
        </h2>
        <ul className="mt-3 space-y-2 text-stone-700 text-sm list-disc pl-5">
          <li>
            Data last verified{" "}
            {new Date(meta.lastVerified + "T12:00:00").toLocaleDateString(
              "en-US",
              { month: "long", day: "numeric", year: "numeric" },
            )}
            . Puja schedules change, especially in the final weeks — always
            confirm with the organizer (every detail page links to them)
            before traveling.
          </li>
          <li>
            Most community pujas celebrate on the nearest weekend rather than
            the exact tithi. Panjika-accurate pujas like Pashchimi run all
            five days (Oct 16–20).
          </li>
          <li>
            Approximate map pins are marked where the exact venue isn&apos;t
            public yet.
          </li>
          <li>
            Parikroma drive times are estimates (straight-line distance with a
            road factor) — not live traffic routing.
          </li>
        </ul>
      </section>

      {/* Organizers: corrections via GitHub */}
      <section className="mt-10 bg-white rounded-2xl border border-stone-200 p-6">
        <h2 className="font-display font-bold text-2xl">
          <span className="block text-dhunuchi text-lg leading-none mb-1">
            সংগঠকদের জন্য — সংশোধনী পাঠান
          </span>
          Organizers: send corrections
        </h2>
        <p className="mt-3 text-stone-700 text-sm">
          Every puja listing on this site — dates, schedules, bhog, tickets,
          cultural programs, contacts — lives in a single public JSON file in
          our GitHub repository. No forms, no waiting on anyone: you can
          propose an edit directly and it goes live once merged.
        </p>
        <ol className="mt-4 space-y-3 text-sm text-stone-700 list-decimal pl-5">
          <li>
            Open{" "}
            <a
              href={DATA_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-sindoor hover:underline"
            >
              data/pujas.json on GitHub ↗
            </a>{" "}
            and click the <strong>pencil icon</strong> (Edit this file).
          </li>
          <li>
            Find your puja (search for its <code className="bg-stone-100 rounded px-1">&quot;id&quot;</code>)
            and update the fields — dates, venue, schedule entries, bhog,
            entry, tickets, contact, notices.
          </li>
          <li>
            Scroll down and click <strong>Propose changes</strong> — GitHub
            forks the repo and opens a <strong>pull request</strong> for you
            automatically.
          </li>
          <li>
            We review and merge — the site rebuilds and your update is live,
            usually within a day.
          </li>
        </ol>
      </section>

      <p className="mt-10 text-center font-display text-sindoor text-lg">
        <Link href="/pujas/" className="hover:underline">
          শুভ পূজা — browse all {pujas.length} pujas →
        </Link>
      </p>

      <div className="mt-10 flex flex-col items-center">
        <KaashPhool className="h-32 text-dhunuchi/30" />
        <p className="flex items-center justify-center gap-2 text-xs text-stone-400 mt-2">
          <Shiuli className="w-3 h-3 text-dhunuchi" />
          Data verified {meta.lastVerified} · Built with ❤ by{" "}
          <a
            href={city.ownerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-display text-sona hover:underline"
          >
            Rabimba
          </a>
        </p>
      </div>
    </div>
  );
}
