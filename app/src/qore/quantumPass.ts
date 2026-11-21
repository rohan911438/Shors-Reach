// Generated from contracts/out (forge build). Do not edit by hand.
export const QUANTUM_PASS_ADDRESS = "0x6e48187e3717af4ccf6c9c27716c5d77d7af5c5d" as const;
export const QUANTUM_PASS_DEPLOY_BLOCK = 10503138n;
export const QUANTUM_PASS_ABI = [
  {
    "type": "function",
    "name": "approve",
    "inputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "pure"
  },
  {
    "type": "function",
    "name": "attestedExposedUsdFloor",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "balanceOf",
    "inputs": [
      {
        "name": "owner",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "chainCounts",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256[16]",
        "internalType": "uint256[16]"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "digest",
    "inputs": [
      {
        "name": "holder",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "scanHash",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "scoreBucket",
        "type": "uint8",
        "internalType": "uint8"
      },
      {
        "name": "chainsMask",
        "type": "uint16",
        "internalType": "uint16"
      },
      {
        "name": "exposedUsdBucket",
        "type": "uint8",
        "internalType": "uint8"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getApproved",
    "inputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "pure"
  },
  {
    "type": "function",
    "name": "isApprovedForAll",
    "inputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "pure"
  },
  {
    "type": "function",
    "name": "locked",
    "inputs": [
      {
        "name": "tokenId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "mint",
    "inputs": [
      {
        "name": "scanHash",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "scoreBucket",
        "type": "uint8",
        "internalType": "uint8"
      },
      {
        "name": "chainsMask",
        "type": "uint16",
        "internalType": "uint16"
      },
      {
        "name": "exposedUsdBucket",
        "type": "uint8",
        "internalType": "uint8"
      },
      {
        "name": "pqSignature",
        "type": "bytes",
        "internalType": "bytes"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "name",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "string",
        "internalType": "string"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "ownerOf",
    "inputs": [
      {
        "name": "tokenId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "owner",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "passOf",
    "inputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "scanHash",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "scoreBucket",
        "type": "uint8",
        "internalType": "uint8"
      },
      {
        "name": "chainsMask",
        "type": "uint16",
        "internalType": "uint16"
      },
      {
        "name": "exposedUsdBucket",
        "type": "uint8",
        "internalType": "uint8"
      },
      {
        "name": "pqAlgorithm",
        "type": "uint8",
        "internalType": "uint8"
      },
      {
        "name": "mintedAt",
        "type": "uint64",
        "internalType": "uint64"
      },
      {
        "name": "pqKeyHash",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "passesByChain",
    "inputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "passesByScoreBucket",
    "inputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "safeTransferFrom",
    "inputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "pure"
  },
  {
    "type": "function",
    "name": "safeTransferFrom",
    "inputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "",
        "type": "bytes",
        "internalType": "bytes"
      }
    ],
    "outputs": [],
    "stateMutability": "pure"
  },
  {
    "type": "function",
    "name": "scoreBuckets",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256[11]",
        "internalType": "uint256[11]"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "setApprovalForAll",
    "inputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "outputs": [],
    "stateMutability": "pure"
  },
  {
    "type": "function",
    "name": "supportsInterface",
    "inputs": [
      {
        "name": "id",
        "type": "bytes4",
        "internalType": "bytes4"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "pure"
  },
  {
    "type": "function",
    "name": "symbol",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "string",
        "internalType": "string"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "totalPasses",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "transferFrom",
    "inputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "pure"
  },
  {
    "type": "event",
    "name": "Locked",
    "inputs": [
      {
        "name": "tokenId",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "PassMinted",
    "inputs": [
      {
        "name": "holder",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "scanHash",
        "type": "bytes32",
        "indexed": false,
        "internalType": "bytes32"
      },
      {
        "name": "scoreBucket",
        "type": "uint8",
        "indexed": false,
        "internalType": "uint8"
      },
      {
        "name": "chainsMask",
        "type": "uint16",
        "indexed": false,
        "internalType": "uint16"
      },
      {
        "name": "exposedUsdBucket",
        "type": "uint8",
        "indexed": false,
        "internalType": "uint8"
      },
      {
        "name": "pqKeyHash",
        "type": "bytes32",
        "indexed": false,
        "internalType": "bytes32"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Transfer",
    "inputs": [
      {
        "name": "from",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "to",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "tokenId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "AlreadyMinted",
    "inputs": []
  },
  {
    "type": "error",
    "name": "BadPqSignature",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NoPass",
    "inputs": []
  },
  {
    "type": "error",
    "name": "OutOfRange",
    "inputs": []
  },
  {
    "type": "error",
    "name": "PqKeyNotRegistered",
    "inputs": []
  },
  {
    "type": "error",
    "name": "PrecompileUnavailable",
    "inputs": []
  },
  {
    "type": "error",
    "name": "Soulbound",
    "inputs": []
  }
] as const;
