import { IoIosArrowBack, IoIosArrowForward } from 'react-icons/io';

export default function ToggleButton({ isCollapsed, toggleNavbar }){
  const rightPosition = isCollapsed ? '-18px' : '-18px'; 
  return (
    <div
      // style={{ right: rightPosition }}
      // className={`relative top-1/2 transform -translate-y-1/2 p-2 bg-[#E0F6EF] rounded-full cursor-pointer transition-all duration-300 ease-in-out`}
      onClick={toggleNavbar}
    >
      {isCollapsed ? (
        <IoIosArrowForward className="text-2xl text-gray-600" />
      ) : (
        <IoIosArrowBack className="text-2xl text-gray-600" />
      )}
    </div>
  );
};
