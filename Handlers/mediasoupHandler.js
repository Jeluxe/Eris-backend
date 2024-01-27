const mediasoup = require("mediasoup");
const config = require("../config/mediasoup-config");
const { getRoom } = require('../services/rooms');

let worker;
let rooms = {};
let peers = {};
let transports = [];
let producers = [];
let consumers = [];

const createWorker = async () => {
  worker = await mediasoup.createWorker({
    logLevel: config.mediasoup.worker.logLevel,
    logTags: config.mediasoup.worker.logTags,
    rtcMinPort: config.mediasoup.worker.rtcMinPort,
    rtcMaxPort: config.mediasoup.worker.rtcMaxPort,
  });
  console.log(`worker pid ${worker.pid}`);

  worker.on("died", (error) => {
    console.error("mediasoup worker has died");
    setTimeout(() => process.exit(1), 2000);
  });

  return worker;
};

worker = createWorker();

module.exports = (socket) => {
  console.log('mediasoup socket on!')
  const mediaCodecs = config.mediasoup.router.mediaCodecs;

  socket.on('error', (error) => {
    console.error('Socket.IO server error: ', error)
  })

  const removeItems = (items, socketId, type) => {
    items.forEach((item) => {
      if (item.socketId === socketId) {
        item[type].close();
      }
    });
    items = items.filter((item) => item.socketId !== socketId);

    return items;
  };

  socket.on("disconnect", () => {
    console.log("peer disconnected");
    closeConnections();
  });

  const closeConnections = () => {
    producers = removeItems(producers, socket.id, "producer");
    consumers = removeItems(consumers, socket.id, "consumer");
    transports = removeItems(transports, socket.id, "transport");
    if (peers[socket.id]) {
      const { roomID } = peers[socket.id];
      delete peers[socket.id];

      rooms[roomID] = {
        ...rooms[roomID],
        peers: rooms[roomID].peers.filter(
          (socketId) => socketId !== socket.id
        ),
      };
    }
  };

  socket.on("leaveRoom", () => closeConnections());

  socket.on("joinRoom", async ({ targetID }, callback) => {
    const room = await getRoom(socket.user.id, targetID);
    const router = await createRoom(room.id, socket.id);
    peers[socket.id] = {
      socket,
      roomID: room.id,
      transports: [],
      producers: [],
      consumers: [],
      peerDetails: {
        name: "",
        isAdmin: false,
      },
    };

    const rtpCapabilities = router.rtpCapabilities;

    callback({ rtpCapabilities });
  });

  const createRoom = async (roomID, socketId) => {
    let router;
    let peers = [];
    if (rooms[roomID]) {
      router = rooms[roomID].router;
      peers = rooms[roomID].peers || [];
    } else {
      router = await worker.createRouter({ mediaCodecs });
    }

    rooms[roomID] = {
      router,
      peers: [...peers, socketId],
    };

    return router;
  };

  // Client emits a request to create server side Transport
  // then we need to differntiate between the producer and consumer transports
  socket.on("createWebRtcTransport", async ({ consumer }, callback) => {
    // get Room Name from Peer's properties
    const roomID = peers[socket.id]?.roomID;

    if (!roomID) return;

    // get Router (Room) object this peer is based on RoomName
    const router = rooms[roomID].router;

    createWebRtcTransport(router).then(
      (transport) => {
        //check if transport exists and it does not have more than 2consumers
        const userTransport = transports.find((transportData) =>
          transportData.socketId === socket.id &&
            transportData.consumer === consumer &&
            consumer
            ? transportData.transport.consumers.size < 2
            : ""
        )?.transport;

        if (userTransport) {
          // if transport already exists then use it
          callback({
            params: {
              error: "transportExists",
              transportId: userTransport.id,
            },
          });
        } else {
          // else create new one in client
          callback({
            params: {
              id: transport.id,
              iceParameters: transport.iceParameters,
              iceCandidates: transport.iceCandidates,
              dtlsParameters: transport.dtlsParameters,
            },
          });
          // add new transport to Peer's properties
          addTransport(transport, roomID, consumer);
        }
      },
      (error) => {
        console.error(error);
      }
    );
  });

  const addTransport = (transport, roomID, consumer) => {
    transports = [
      ...transports,
      { socketId: socket.id, transport, roomID, consumer },
    ];

    peers[socket.id] = {
      ...peers[socket.id],
      transports: [peers[socket.id].transports, transport.id],
    };
    console.log(transports.length, "transports");
  };

  const addProducer = (producer, roomID) => {
    producers = [
      ...producers,
      { socketId: socket.id, producer, roomID },
    ];

    peers[socket.id] = {
      ...peers[socket.id],
      producers: [...peers[socket.id].producers, producer.id],
    };
    console.log(producers.length, "producers");
  };

  const addConsumer = (consumer, roomID) => {
    consumers = [
      ...consumers,
      { socketId: socket.id, consumer, roomID },
    ];

    peers[socket.id] = {
      ...peers[socket.id],
      consumers: [...peers[socket.id].consumers, consumer.id],
    };
    console.log(consumers.length, "consumers");
  };

  socket.on("peersExist", (cb) => {
    const { roomID } = peers[socket.id];
    cb(rooms[roomID].peers.length > 1 ? true : false);
  });

  socket.on("getProducers", (callback) => {
    // get all producer ids
    const { roomID } = peers[socket.id];

    let producerList = [];
    producers.forEach((producerData) => {
      if (
        producerData.socketId !== socket.id &&
        producerData.roomID === roomID
      ) {
        producerList = [...producerList, producerData.producer.id];
      }
    });
    // return the producer list back to the client
    callback(producerList);
  });

  const informUsers = (roomID, socketId, producerId, kind) => {
    // A new producer has been created
    // let all users to consume this producer
    if (rooms[roomID].peers.length > 1) {
      producers.forEach((producerData, idx) => {
        if (
          producerData.socketId !== socketId &&
          producerData.roomID === roomID &&
          producerData.producer.kind === kind
        ) {
          const producerSocket = peers[producerData.socketId].socket;
          producerSocket.emit("new-producer", { producerId });
        }
      });
    }
  };

  socket.on("inform-consumers", (producerId, kind) => {
    const { roomID } = peers[socket.id];
    informUsers(roomID, socket.id, producerId, kind);
  });

  const getTransport = (socketId) => {
    const [producerTransport] = transports.filter(
      (transport) => transport.socketId === socketId && !transport.consumer
    );
    return producerTransport.transport;
  };

  socket.on("transport-connect", ({ dtlsParameters }) => {
    getTransport(socket.id).connect({ dtlsParameters });
  });

  socket.on(
    "transport-produce",
    async ({ kind, rtpParameters }, callback) => {
      const producer = await getTransport(socket.id).produce({
        kind,
        rtpParameters,
      });

      const { roomID } = peers[socket.id];

      //add producer to the producers list
      addProducer(producer, roomID);

      producer.on("transportclose", () => {
        //
        updateConsumers(producer.id);
        producer.close();
      });

      callback({ id: producer.id, kind });
    }
  );

  socket.on(
    "transport-recv-connect",
    async ({ dtlsParameters, serverConsumerTransportId }) => {
      const consumerTransport = transports.find(
        (transportData) =>
          transportData.consumer &&
          transportData.transport.id === serverConsumerTransportId &&
          transportData.transport.consumers.size < 2
      ).transport;

      try {
        await consumerTransport.connect({ dtlsParameters });
      } catch (error) {
        console.log("already connected");
      }
    }
  );

  socket.on(
    "consume",
    async (
      { rtpCapabilities, remoteProducerId, serverConsumerTransportId },
      callback
    ) => {
      try {
        const { roomID } = peers[socket.id];
        const router = rooms[roomID].router;
        let consumerTransport = transports.find(
          (transportData) =>
            transportData.consumer &&
            transportData.transport.id === serverConsumerTransportId
        ).transport;

        if (
          router.canConsume({
            producerId: remoteProducerId,
            rtpCapabilities,
          })
        ) {
          const consumer = await consumerTransport.consume({
            producerId: remoteProducerId,
            rtpCapabilities,
            paused: true,
          });

          consumer.on("transportclose", () => {
            console.log("transport close from consumer");
          });

          consumer.on("producerclose", () => {
            console.log("producer of consumer closed");

            updateConsumers(remoteProducerId);

            socket.emit("producer-closed", { remoteProducerId });

            consumer.close();

            consumerTransport.close();
            transports = transports.filter(
              (transportData) =>
                transportData.transport.id !== consumerTransport.id
            );
          });

          addConsumer(consumer, roomID);

          const params = {
            id: consumer.id,
            producerId: remoteProducerId,
            kind: consumer.kind,
            rtpParameters: consumer.rtpParameters,
            serverConsumerId: consumer.id,
          };

          callback({ params });
        }
      } catch (error) {
        console.error(error.message);
        callback({
          params: {
            error,
          },
        });
      }
    }
  );

  socket.on("consumer-resume", async ({ serverConsumerId }) => {
    const { consumer } = consumers?.find(
      (consumerData) => consumerData.consumer.id === serverConsumerId
    );
    if (consumer) {
      await consumer.resume();
    }
  });

  const updateConsumers = (remoteProducerId) => {
    consumers = consumers.filter(
      ({ consumer: { producerId } }) => producerId !== remoteProducerId
    );
  };

  const createWebRtcTransport = async (router) => {
    return new Promise(async (resolve, reject) => {
      try {
        const transport = await router.createWebRtcTransport({
          listenIps: config.mediasoup.webRtcTransport.listenIps,
          enableUdp: true,
          enableTcp: true,
          preferUdp: true,
        });

        transport.on("dtlsstatechange", (dtlsState) => {
          if (dtlsState === "closed") {
            transport.close();
          }
        });

        transport.on("close", () => {
          console.log("transport closed");
        });

        resolve(transport);
      } catch (error) {
        reject(error);
      }
    });
  };
}