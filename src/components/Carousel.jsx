"use client";
import { Carousel } from "@material-tailwind/react";
import Image from "next/image";
import Autoplay from 'embla-carousel-autoplay';
import useEmblaCarousel from 'embla-carousel-react';

const EmblaCarousel = ({ slides, options }) => {
    const autoplayOptions = {
        delay: 5000, 
        stopOnInteraction: true, 
      };
    
      const [emblaRef, emblaApi] = useEmblaCarousel(options, [Autoplay(autoplayOptions)]);
    return (
      <section className="embla">
        <div className="embla__viewport" ref={emblaRef}>
          <div className="embla__container">
            {slides.map((slide, index) => (
              <div className="embla__slide" key={index}>
                {/* Use Next.js Image component for rendering images */}
                <Image
                  src={slide.src}
                  alt={slide.alt}
                  width={slide.width}
                  height={slide.height}
                  layout="responsive"
                />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  };
  
  export default EmblaCarousel;
