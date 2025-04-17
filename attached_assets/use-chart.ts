import { useEffect, useState } from "react";

export function useChart(container: HTMLDivElement | null, data: any) {
  const [chart, setChart] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let chartInstance: any = null;
    
    const initChart = async () => {
      setIsLoading(true);
      
      try {
        if (!container || !data) return;
        
        // Dynamic import to reduce initial load time
        const { Chart, registerables } = await import('chart.js');
        Chart.register(...registerables);
        
        // Clean up any existing chart
        if (chartInstance) {
          chartInstance.destroy();
        }
        
        // Create gradient
        const ctx = container.querySelector('canvas')?.getContext('2d');
        if (!ctx) {
          const canvas = document.createElement('canvas');
          canvas.width = container.clientWidth;
          canvas.height = container.clientHeight;
          container.appendChild(canvas);
          
          const newCtx = canvas.getContext('2d');
          if (!newCtx) return;
          
          const gradient = newCtx.createLinearGradient(0, 0, 0, 400);
          gradient.addColorStop(0, 'rgba(0, 229, 179, 0.5)');
          gradient.addColorStop(1, 'rgba(0, 229, 179, 0)');
          
          chartInstance = new Chart(newCtx, {
            type: 'line',
            data: {
              labels: data.labels,
              datasets: [
                {
                  label: `${data.timeFrame} Price`,
                  data: data.prices,
                  borderColor: '#00e5b3',
                  borderWidth: 2,
                  tension: 0.4,
                  pointRadius: 0,
                  pointHoverRadius: 3,
                  pointBackgroundColor: '#00e5b3',
                  backgroundColor: gradient,
                  fill: true,
                }
              ]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                x: {
                  grid: {
                    display: false,
                    drawBorder: false,
                  },
                  ticks: {
                    display: false,
                  }
                },
                y: {
                  position: 'right',
                  grid: {
                    color: 'rgba(255, 255, 255, 0.05)',
                    drawBorder: false,
                  },
                  ticks: {
                    color: '#8492b4',
                    font: {
                      size: 10,
                    },
                    padding: 10
                  }
                }
              },
              plugins: {
                legend: {
                  display: false,
                },
                tooltip: {
                  backgroundColor: '#1f3158',
                  titleColor: '#ffffff',
                  bodyColor: '#ffffff',
                  displayColors: false,
                  padding: 10,
                  cornerRadius: 4,
                  titleFont: {
                    family: "'Poppins', sans-serif",
                    size: 12,
                  },
                  bodyFont: {
                    family: "'Open Sans', sans-serif",
                    size: 11,
                  },
                }
              },
              animation: {
                duration: 1000,
              },
              interaction: {
                mode: 'index',
                intersect: false,
              },
            }
          });
          
          setChart(chartInstance);
        }
      } catch (error) {
        console.error('Error initializing chart:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    initChart();
    
    return () => {
      if (chartInstance) {
        chartInstance.destroy();
      }
    };
  }, [container, data]);
  
  return { chart, isLoading };
}
