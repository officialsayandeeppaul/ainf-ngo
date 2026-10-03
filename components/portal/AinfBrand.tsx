import Link from "next/link";

/** Official AINF seal + wordmark used in the portal navbar. */
export function AinfBrand() {
  return (
    <Link href="/" className="pt-brand" aria-label="AINF home">
      <span className="pt-brand__badge">
        <img
          src="/assets/img/theainf-logo.webp"
          alt=""
          width={80}
          height={80}
          className="pt-brand__logo"
        />
      </span>
      <span className="pt-brand__text">AINF</span>
    </Link>
  );
}
