import { useContext, useEffect, useState } from "react"; // React hooks for state and lifecycle management
import { DisplayContext } from "../../context/DisplayContext"; // Context for display settings
import useGroupBy from "../../hooks/useGroupBy"; // Custom hook for grouping data
import useOrderBy from "../../hooks/useOrderBy"; // Custom hook for ordering data
import classes from "./Board.module.css"; // CSS module for Board component styling
import Group from "./Group"; // Group component for displaying each data group

const Board = () => {
    const [isLoading, setIsLoading] = useState(false); // State to track data loading status
    const [rawData, setRawData] = useState(null); // State to hold the fetched data
    const [error, setError] = useState(null); // State to hold any errors during data fetching
    const { groupBy, orderBy } = useContext(DisplayContext); // Extracting display settings from context

    // Function to open IndexedDB
    function openDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('myDatabase', 1);

            request.onerror = (event) => reject('Error opening database');
            request.onsuccess = (event) => resolve(event.target.result);

            // Create object store if not already created
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('kanbanBoard')) {
                    db.createObjectStore('kanbanBoard', { keyPath: 'id' });
                }
            };
        });
    }

    // Function to store data with an expiry time
    function storeDataWithExpiry(data, expiryInHours) {
        openDatabase().then((db) => {
            const transaction = db.transaction('kanbanBoard', 'readwrite');
            const store = transaction.objectStore('kanbanBoard');

            // Calculate expiry time
            const now = new Date();
            const expiryTime = now.getTime() + expiryInHours * 60 * 60 * 1000;

            // Create data object
            const item = {
                id: 'quicksell-kanbanboard',
                value: data,
                expiry: expiryTime
            };

            store.put(item);
            transaction.oncomplete = () => console.log('Data stored successfully');
            transaction.onerror = () => console.error('Error storing data');
        });
    }

    // Function to get data from IndexedDB with expiry check
    async function getDataWithExpiry() {
        return new Promise((resolve, reject) => {
            openDatabase().then((db) => {
                const transaction = db.transaction('kanbanBoard', 'readonly');
                const store = transaction.objectStore('kanbanBoard');

                const request = store.get('quicksell-kanbanboard');
                request.onsuccess = (event) => {
                    const item = event.target.result;

                    if (!item) {
                        return resolve(null); // No data found
                    }

                    const now = new Date();

                    // Check if data has expired
                    if (now.getTime() > item.expiry) {
                        store.delete('quicksell-kanbanboard'); // Data expired, delete it
                        return resolve(null);
                    }

                    resolve(item.value); // Return valid data
                };

                request.onerror = (event) => reject('Error retrieving data from IndexedDB');
            });
        });
    }

    // Function to fetch raw data from the API or load from IndexedDB
    const fetchRawData = async () => {
        setIsLoading(true); // Indicate the start of data fetching
        
        try {
            // First, check if data is available in IndexedDB and not expired
            // const cachedData = await getDataWithExpiry();
            // const cachedData=[];
            
            // if (cachedData) {
            //     setRawData(cachedData); // Set the data from IndexedDB if available
            //     console.log('Data loaded from IndexedDB');
            // } else {
                // If no cached data or expired, fetch from the API
                const response = await fetch(
                    "https://api.quicksell.co/v1/internal/frontend-assignment"
                );
                const data = await response.json(); // Parse the JSON data from response
                setRawData(data); // Set the fetched data into state

                // Store the new data in IndexedDB with a 2-hour expiry
                storeDataWithExpiry(data, 2);
                console.log('Data fetched from API and stored in IndexedDB');
            // }
        } catch (error) {
            setError(
                "Unable to load data. Please check your internet connection or try again later as the server may be down."
            ); // Handle errors like network issues or server problems
            console.error('Error fetching data:', error);
        } finally {
            setIsLoading(false); // Indicate the end of data fetching
        }
    };

    // useEffect hook to initiate data fetching on component mount
    useEffect(() => {
        fetchRawData();
    }, []);

    // Use custom hooks to group and order the fetched data
    const groupedData = useGroupBy(rawData, groupBy);
    const groupedAndOrderedData = useOrderBy(groupedData, orderBy);

    // Render the Board UI with conditionally displayed messages and Group components
    return (
        <div className={classes.board}>
            {/* Main board container */}
            <div className={classes.header}>
                <h1>Kanban Board</h1>
            </div>
            {isLoading && (
                <div className={classes.loading}>
                    <div className={classes.spinner}></div>
                    <p>Loading your tasks...</p>
                </div>
            )}
            {rawData && (
                <div className={classes.groupsContainer}>
                    {Object.keys(groupedAndOrderedData).map((groupKey) => (
                        <Group
                            key={groupKey}
                            title={groupKey}
                            data={groupedAndOrderedData[groupKey]}
                        /> // Render a Group component for each group in the processed data
                    ))}
                </div>
            )}
            {error && (
                <div className={classes.error}>
                    <h2>Oops! Something went wrong</h2>
                    <p>{error}</p>
                    <button onClick={fetchRawData} className={classes.retryButton}>Try Again</button>
                </div>
            )}
        </div>
    );
};

export default Board; // Export Board component for use in the application
