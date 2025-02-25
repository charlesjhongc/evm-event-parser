import { useState } from "react";
import { createPublicClient, http } from "viem";
import { ERC20_ABI, ERC721_ABI } from "./abi.tsx";
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
  const [customABI, setCustomABI] = useState([]);
  const [doCustom, setDoCustom] = useState(true);
  const [indexedFilters, setIndexedFilters] = useState({});
  const [eventsABI, setEventsABI] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState("");
  const [clickedButton, setClickedButton] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const eventsPerPage = 15;

  function handleInputChange(e) {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (e.target.name === "contractABI") {
      const newABI = e.target.value.trim();
      if (!newABI) {
        setEventsABI([]);
        setSelectedEvent("");
        return;
      }
      const abi = JSON.parse(newABI);
      setCustomABI(abi);
      updateEventList(abi); // update available events
    }
  }

  function handleEventSelect(e) {
    setSelectedEvent(e.target.value);
  }

  function handleFilterChange(paramName, value) {
    setIndexedFilters({ ...indexedFilters, [paramName]: value });
  }

  function handleSelectInterface(type: "ERC20" | "ERC721" | "Custom") {
    if (type === "ERC20") {
      setError("");
      setClickedButton(1);
      updateEventList(ERC20_ABI);
      setDoCustom(false);
      setError("");
    } else if (type === "ERC721") {
      setError("");
      setClickedButton(2);
      updateEventList(ERC721_ABI);
      setDoCustom(false);
    } else {
      setError("");
      setClickedButton(0);
      setDoCustom(true);
      updateEventList(customABI); // update available events
    }
  }

  function bigIngStringify(key, value) {
    if (typeof value === "bigint") {
      return value.toString();
    }
    return value;
  }

  function updateEventList(abi) {
    try {
      const abiEvents = abi.filter((item) => item.type === "event");

      if (abiEvents.length === 0) {
        throw new Error("No events found in the ABI definition");
      }

      setEventsABI(abiEvents);
      setSelectedEvent(abiEvents[0].name); // Default to first event if available
    } catch (err) {
      setEventsABI([]);
      setSelectedEvent("");
    }
  }

  function parseBlockTag(str, latestBlockNum) {
    try {
      let parsed = BigInt(str);
      return parsed < 0 ? latestBlockNum + parsed : parsed;
    } catch (error) {
      return str;
    }
  }

  function DumpEvents({ events }) {
    return (
      <table>
        <thead>
          <tr>
            <th>Block</th>
            <th>Transaction Hash</th>
            <th>Arguments</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event, index) => (
            <tr key={index}>
              <td>{event.blockNumber}</td>
              <td>{event.txHash}</td>
              <td>
                <pre>{JSON.stringify(event.args, bigIngStringify, 2)}</pre>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  async function fetchEvents() {
    try {
      setLoading(true);
      setError("");

      const publicClient = createPublicClient({
        transport: http(formData.rpcEndpoint),
      });

      const latestBlk = await publicClient.getBlock();
      const argsFilters = Object.entries(indexedFilters).reduce(
        (acc, [key, value]) => {
          if (value.length != 0) {
            acc[key] = value.split(",").map((item) => item.trim());
          }
          return acc;
        },
        {}
      );
      const logs = await publicClient.getContractEvents({
        abi: eventsABI,
        address: formData.contractAddress,
        eventName: selectedEvent,
        fromBlock: parseBlockTag(formData.fromBlock, latestBlk.number),
        toBlock: parseBlockTag(formData.toBlock, latestBlk.number),
        args: argsFilters,
      });
      const parsedEvents = logs.map((log) => {
        return {
          blockNumber: log.blockNumber,
          txHash: log.transactionHash,
          args: log.args,
        };
      });

      parsedEvents.name = selectedEvent;
      setEvents(parsedEvents);
      setCurrentPage(1);
    } catch (err) {
      setError(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  const indexOfLastEvent = currentPage * eventsPerPage;
  const indexOfFirstEvent = indexOfLastEvent - eventsPerPage;
  const currentEvents = events.slice(indexOfFirstEvent, indexOfLastEvent);
  const totalPages = Math.ceil(events.length / eventsPerPage);
  const paginate = (pageNumber) => setCurrentPage(pageNumber);

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
          <label>Interface Definition</label>
          <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
            <button
              className={clickedButton === 0 ? "active" : "inactive"}
              onClick={() => handleSelectInterface("Custom (JSON ABI)")}
            >
              Custom
            </button>
            <button
              className={clickedButton === 1 ? "active" : "inactive"}
              onClick={() => handleSelectInterface("ERC20")}
            >
              ERC20
            </button>
            <button
              className={clickedButton === 2 ? "active" : "inactive"}
              onClick={() => handleSelectInterface("ERC721")}
            >
              ERC721
            </button>
          </div>
          {doCustom && (
            <div>
              <textarea
                name="contractABI"
                placeholder='e.g. [{"type": "event", "name": "Transfer", "inputs": [{"name": "from", "type": "address", "indexed": true}, {"name": "to", "type": "address", "indexed": true}, {"name": "value", "type": "uint256"}]}]'
                value={formData.contractABI}
                onChange={handleInputChange}
              />
              <small
                style={{ display: "block", marginTop: "5px", color: "gray" }}
              >
                You can compile solidity and get ABI using{" "}
                <a
                  href="https://remix.ethereum.org/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Remix
                </a>
              </small>
            </div>
          )}
        </div>

        {eventsABI.length > 0 && (
          <div className="form-group">
            <div>
              <label>Select Event to Parse:</label>
              <select
                value={selectedEvent}
                onChange={handleEventSelect}
                disabled={loading}
              >
                {eventsABI.map((event) => (
                  <option key={event.name} value={event.name}>
                    {event.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="advanced-filter">
              <div className="advanced-filter-label">
                Advanced Filter (optional)
              </div>
              {eventsABI
                .find((event) => event.name === selectedEvent)
                .inputs.filter((input) => input.indexed === true)
                .map((param) => (
                  <div key={param.name} className="advanced-input">
                    <label>
                      {param.name} ({param.type}):
                      <input
                        type="text"
                        value={indexedFilters[param.name] || ""}
                        onChange={(e) =>
                          handleFilterChange(param.name, e.target.value)
                        }
                        placeholder={`Enter ${param.name} value`}
                      />
                    </label>
                  </div>
                ))}
            </div>
          </div>
        )}

        <div className="form-group">
          <label>Start Block:</label>
          <input
            name="fromBlock"
            placeholder="Enter a block tag (bigint | 'latest')"
            value={formData.fromBlock}
            onChange={handleInputChange}
          />
        </div>

        <div className="form-group">
          <label>End Block:</label>
          <input
            name="toBlock"
            placeholder="Enter a block tag (bigint | 'latest')"
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
          <h2>
            Parsed Events : {events.name} (total:{events.length})
          </h2>
          <DumpEvents events={currentEvents} />

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
