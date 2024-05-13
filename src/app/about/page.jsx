import Image from 'next/image';
import Link from 'next/link';
import { FaInstagram, FaLinkedin, FaGithub } from 'react-icons/fa';


export default function About() {
    return(
        <div className="flex flex-col items-center  justify-center w-full min-h-screen pb-10 px-10">
      <h1 className="text-2xl font-semibold text-[#559F87] mb-10">About us</h1>

      <div className="flex gap-20 mb-10">
        {/* Profile for Doniyor Ismatilloev */}
        <div className="text-center">
          <Image src="/image/doniyor.png" alt="Doniyor Ismatilloev" width={160} height={160} className="rounded-full object-cover mb-4 border-2 border-spacing-2 border-[#559F87] " />
          <h2 className="font-semibold">Doniyor Ismatilloev</h2>
          <p className="flex justify-center gap-4">
            <Link href="https://www.instagram.com/doniyor134/"><FaInstagram className="text-xl" /></Link>
            <Link href="https://www.linkedin.com/in/doniyor2024/"><FaLinkedin className="text-xl" /></Link>
            <Link href="https://github.com/DoniyorI"><FaGithub className="text-xl" /></Link>
          </p>
        </div>

        {/* Profile for Cal Thanga */}
        <div className="text-center">
          <Image src="/image/cal.png" alt="Cal Thanga" width={160} height={160} className="rounded-full object-cover mb-4 border-2 border-spacing-2 border-[#559F87]"/>
          <h2 className="font-semibold">Cal Thanga</h2>
          <p className="flex justify-center gap-4">
            <Link href="https://www.instagram.com/zodintch/"><FaInstagram className="text-xl" /></Link>
            <Link href="https://www.linkedin.com/in/cal-thanga-71199b183/"><FaLinkedin className="text-xl" /></Link>
            <Link href="https://github.com/ZodinTC"><FaGithub className="text-xl" /></Link>
          </p>
        </div>
      </div>

      <p className="text-center max-w-2xl">
      As students stepping into the professional world, we found ourselves constantly struggling with the job application process. Crafting a new resume for each application was exhausting and seemingly endless. Frustrated with mass applying and getting minimal responses, we sought a better way. That's how "Resume Butler" was born—a platform designed from our own need to manage job applications efficiently, create personalized resumes and cover letters, and leverage AI to customize resumes perfectly suited for each job based on our unique projects and experiences. With Resume Butler, you no longer just apply; you apply smartly and stand out.
      </p>
    </div>
    );
}