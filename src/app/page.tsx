import { redirect } from "next/navigation";

// Frontend is now a static multi-page HTML bundle in /public.
// Hand off the root URL to the bundle's entry page.
export default function Page() {
  redirect("/index.html");
}
