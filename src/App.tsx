import { useState } from "react";
import { createPublicClient, http } from "viem";
import { ERC20_ABI, ERC721_ABI } from "./abi.tsx";
import "./App.css";

interface AbiEventInput {
  name: string;
  type: string;
  indexed?: boolean;
}

interface AbiEventItem {
  type: string;
  name: string;
  inputs?: AbiEventInput[];
}

interface EventLogEntry {
  blockNumber: bigint | null;
  txHash: `0x${string}` | null;
  args: Record<string, unknown> | readonly unknown[];
}

function App() {
  const [formData, setFormData] = useState({
    contractAddress: "",
    contractABI: "",
    fromBlock: "",
    toBlock: "",
    rpcEndpoint: "",
  });
  const [events, setEvents] = useState<EventLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [customABI, setCustomABI] = useState<AbiEventItem[]>([]);
  const [doCustom, setDoCustom] = useState(true);
  const [indexedFilters, setIndexedFilters] = useState<Record<string, string>>({});
  const [eventsABI, setEventsABI] = useState<AbiEventItem[]>([]);
  const [selectedEvent, setSelectedEvent] = useState("");
  const [clickedButton, setClickedButton] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const eventsPerPage = 15;

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (e.target.name === "contractABI") {
      const newABI = e.target.value.trim();
      if (!newABI) {
        setEventsABI([]);
        setSelectedEvent("");
        return;
      }
      const abi = JSON.parse(newABI) as AbiEventItem[];
      setCustomABI(abi);
      updateEventList(abi); // update available events
    }
  }

  function handleEventSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    setSelectedEvent(e.target.value);
  }

  function handleFilterChange(paramName: string, value: string) {
    setIndexedFilters({ ...indexedFilters, [paramName]: value });
  }

  function handleSelectInterface(type: "ERC20" | "ERC721" | "Custom") {
    if (type === "ERC20") {
      setError("");
      setClickedButton(1);
      updateEventList(ERC20_ABI as AbiEventItem[]);
      setDoCustom(false);
      setError("");
    } else if (type === "ERC721") {
      setError("");
      setClickedButton(2);
      updateEventList(ERC721_ABI as AbiEventItem[]);
      setDoCustom(false);
    } else {
      setError("");
      setClickedButton(0);
      setDoCustom(true);
      updateEventList(customABI); // update available events
    }
  }

  function bigIntStringify(_key: string, value: unknown): unknown {
    if (typeof value === "bigint") {
      return value.toString();
    }
    return value;
  }

  function updateEventList(abi: AbiEventItem[]) {
    try {
      const abiEvents = abi.filter((item) => item.type === "event");

      if (abiEvents.length === 0) {
        throw new Error("No events found in the ABI definition");
      }

      setEventsABI(abiEvents);
      setSelectedEvent(abiEvents[0].name); // Default to first event if available
    } catch {
      setEventsABI([]);
      setSelectedEvent("");
    }
  }

  function parseBlockTag(str: string, latestBlockNum: bigint): bigint | string {
    const trimmed = str.trim();
    if (trimmed === "") {
      return latestBlockNum;
    }
    const lower = trimmed.toLowerCase();
    // Tag form: "latest", "latest +100", "latest-50"
    if (lower === "latest") {
      return latestBlockNum;
    }
    const latestWithOffset = lower.match(/^latest\s*([+-]?\d+)$/);
    if (latestWithOffset) {
      return latestBlockNum + BigInt(latestWithOffset[1]);
    }
    // Pure number: leading +- = relative to latest, else absolute block number
    try {
      const parsed = BigInt(trimmed);
      if (trimmed.startsWith("+")) {
        return latestBlockNum + parsed;
      }
      if (trimmed.startsWith("-")) {
        return latestBlockNum - BigInt(trimmed.slice(1));
      }
      return parsed;
    } catch {
      return str;
    }
  }

  function DumpEvents({ events }: { events: EventLogEntry[] }) {
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
                <pre>{JSON.stringify(event.args, bigIntStringify, 2)}</pre>
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
        (acc: Record<string, string[]>, [key, value]) => {
          if (value.length !== 0) {
            acc[key] = value.split(",").map((item: string) => item.trim());
          }
          return acc;
        },
        {}
      );
      const fromBlock = parseBlockTag(formData.fromBlock, latestBlk.number);
      const toBlock = parseBlockTag(formData.toBlock, latestBlk.number);
      const logs = await publicClient.getContractEvents({
        abi: eventsABI,
        ...(formData.contractAddress && {
          address: formData.contractAddress as `0x${string}`,
        }),
        eventName: selectedEvent,
        fromBlock: typeof fromBlock === "bigint" ? fromBlock : undefined,
        toBlock: typeof toBlock === "bigint" ? toBlock : undefined,
        args: argsFilters,
      });
      const parsedEvents: EventLogEntry[] = logs.map((log) => {
        const logWithArgs = log as { blockNumber: bigint; transactionHash: `0x${string}`; args?: Record<string, unknown> };
        return {
          blockNumber: logWithArgs.blockNumber,
          txHash: logWithArgs.transactionHash,
          args: logWithArgs.args ?? {},
        };
      });

      setEvents(parsedEvents);
      setCurrentPage(1);
    } catch (err) {
      setError(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  const indexOfLastEvent = currentPage * eventsPerPage;
  const indexOfFirstEvent = indexOfLastEvent - eventsPerPage;
  const currentEvents = events.slice(indexOfFirstEvent, indexOfLastEvent);
  const totalPages = Math.ceil(events.length / eventsPerPage);
  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

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
              onClick={() => handleSelectInterface("Custom")}
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
              {(eventsABI
                .find((event) => event.name === selectedEvent)
                ?.inputs?.filter((input: AbiEventInput) => input.indexed === true) ?? []).map((param) => (
                  <div key={param.name} className="advanced-input">
                    <label>
                      {param.name} ({param.type}):
                      <input
                        type="text"
                        value={indexedFilters[param.name] ?? ""}
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
            placeholder="e.g. 12345, latest, latest -100, +500"
            value={formData.fromBlock}
            onChange={handleInputChange}
          />
        </div>

        <div className="form-group">
          <label>End Block:</label>
          <input
            name="toBlock"
            placeholder="e.g. 12345, latest, latest +0, -50"
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
            Parsed Events : {selectedEvent} (total:{events.length})
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
