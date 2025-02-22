// App.jsx
import React, { useState } from "react";
import { ethers } from "ethers";
import "./App.css";

function App() {
  const [formData, setFormData] = useState({
    contractAddress: "",
    contractABI: "",
    fromBlock: "",
    toBlock: "",
    rpcEndpoint: "",
  });
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [availableEvents, setAvailableEvents] = useState([]); // Store available events from ABI
  const [selectedEvent, setSelectedEvent] = useState(""); // Track selected event
  const eventsPerPage = 10;

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleInterfaceChange = (e) => {
    const newABI = e.target.value.trim();
    setFormData({ ...formData, contractABI: newABI });
    parseAbi(newABI); // Parse ABI to update available events
  };

  const parseAbi = (abi) => {
    try {
      if (!abi) {
        setAvailableEvents([]);
        setSelectedEvent("");
        return;
      }

      const contractInterface = new ethers.Interface(abi);
      const eventsFromAbi = contractInterface.fragments.filter(
        (f) => f.type === "event"
      );

      if (eventsFromAbi.length === 0) {
        throw new Error("No events found in the ABI definition");
      }

      setAvailableEvents(eventsFromAbi.map((event) => event.name));
      setSelectedEvent(eventsFromAbi[0].name); // Default to first event if available
    } catch (err) {
      setError(`Error parsing ABI: ${err.message}`);
      setAvailableEvents([]);
      setSelectedEvent("");
    }
  };

  const fetchEvents = async () => {
    try {
      setLoading(true);
      setError("");

      const provider = new ethers.JsonRpcProvider(formData.rpcEndpoint);
      const contract = new ethers.Contract(
        formData.contractAddress,
        formData.contractABI,
        provider
      );
      const filter = contract.filters[selectedEvent]();

      const fromBlock = parseInt(formData.fromBlock);
      const toBlock = parseInt(formData.toBlock);

      const logs = await contract.queryFilter(
        filter,
        isNaN(fromBlock) ? formData.fromBlock : fromBlock,
        isNaN(toBlock) ? formData.toBlock : toBlock
      );
      const parsedEvents = logs.map((log) => {
        const parsed = contract.interface.parseLog(log);
        return {
          blockNumber: log.blockNumber,
          txHash: log.transactionHash,
          args: Object.fromEntries(
            parsed.fragment.inputs.map((input, i) => {
              const value = parsed.args[i];
              // Convert BigInt to string or number
              return [
                input.name,
                typeof value === "bigint" ? value.toString() : value,
              ];
            })
          ),
        };
      });

      setEvents(parsedEvents);
      setCurrentPage(1);
    } catch (err) {
      setError(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const indexOfLastEvent = currentPage * eventsPerPage;
  const indexOfFirstEvent = indexOfLastEvent - eventsPerPage;
  const currentEvents = events.slice(indexOfFirstEvent, indexOfLastEvent);
  const totalPages = Math.ceil(events.length / eventsPerPage);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  const handleEventSelect = (e) => {
    setSelectedEvent(e.target.value);
  };

  return (
    <div className="App">
      <h1>EVM Event Parser</h1>

      <div className="form-container">
        <div className="form-group">
          <label>Contract Address:</label>
          <input
            name="contractAddress"
            placeholder="e.g. 0x..."
            value={formData.contractAddress}
            onChange={handleInputChange}
          />
        </div>

        <div className="form-group">
          <label>Interface Definition (JSON ABI):</label>
          <textarea
            name="interfaceDef"
            placeholder='e.g. [{"type": "event", "name": "Transfer", "inputs": [{"name": "from", "type": "address", "indexed": true}, {"name": "to", "type": "address", "indexed": true}, {"name": "value", "type": "uint256"}]}]'
            value={formData.contractABI}
            onChange={handleInterfaceChange}
          />
        </div>

        {availableEvents.length > 0 && (
          <div className="form-group">
            <label>Select Event to Parse:</label>
            <select
              value={selectedEvent}
              onChange={handleEventSelect}
              disabled={loading}
            >
              {availableEvents.map((eventName) => (
                <option key={eventName} value={eventName}>
                  {eventName}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="form-group">
          <label>Start Block:</label>
          <input
            name="fromBlock"
            placeholder="Enter a positive number"
            value={formData.fromBlock}
            onChange={handleInputChange}
          />
        </div>

        <div className="form-group">
          <label>End Block:</label>
          <input
            name="toBlock"
            placeholder="Enter a positive number (optional)"
            value={formData.toBlock}
            onChange={handleInputChange}
          />
        </div>

        <div className="form-group">
          <label>RPC Endpoint:</label>
          <input
            name="rpcEndpoint"
            placeholder="e.g. https://base-mainnet.g.al"
            value={formData.rpcEndpoint}
            onChange={handleInputChange}
          />
        </div>

        <button onClick={fetchEvents} disabled={loading}>
          {loading ? "Loading..." : "Parse Events"}
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      {events.length > 0 && (
        <div className="results">
          <h2>Parsed Events ({events.length})</h2>
          <table>
            <thead>
              <tr>
                <th>Block</th>
                <th>Transaction Hash</th>
                <th>Arguments</th>
              </tr>
            </thead>
            <tbody>
              {currentEvents.map((event, index) => (
                <tr key={index}>
                  <td>{event.blockNumber}</td>
                  <td>{event.txHash}</td>
                  <td>
                    <pre>{JSON.stringify(event.args, null, 2)}</pre>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="pagination">
            <button
              onClick={() => paginate(currentPage - 1)}
              disabled={currentPage === 1}
            >
              Previous
            </button>
            <span>
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => paginate(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
